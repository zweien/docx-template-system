import { db } from "@/lib/db";
import { deleteFile, saveCollectionTaskAttachment } from "@/lib/file.service";
import {
  canManageDocumentCollectionTask,
  deriveDocumentCollectionSubmissionStatus,
  getDocumentCollectionViewerRole,
} from "@/lib/services/document-collection-permission.service";
import { createNotifications } from "@/lib/services/notification.service";
import type { ServiceResult } from "@/types/data-table";
import type {
  DocumentCollectionAssigneeItem,
  DocumentCollectionAttachmentItem,
  DocumentCollectionCreateTaskInput,
  DocumentCollectionTaskDetailView,
  DocumentCollectionTaskListItem,
} from "@/types/document-collection";

type CreateTaskInput = DocumentCollectionCreateTaskInput & {
  creatorId: string;
};

type ListTasksInput = {
  userId: string;
  scope?: "created" | "assigned" | "all";
  status?: "active" | "closed";
  search?: string;
  now?: Date;
};

type GetTaskDetailInput = {
  taskId: string;
  userId: string;
  now?: Date;
};

type CloseTaskInput = {
  taskId: string;
  userId: string;
};

function mapAttachment(attachment: {
  id: string;
  taskId: string;
  fileName: string;
  originalFileName: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  uploadedById: string;
  uploadedBy?: { name?: string | null };
  createdAt: Date;
}): DocumentCollectionAttachmentItem {
  return {
    id: attachment.id,
    taskId: attachment.taskId,
    fileName: attachment.fileName,
    originalFileName: attachment.originalFileName,
    storagePath: `/api/collections/${attachment.taskId}/attachments/${attachment.id}/download`,
    fileSize: attachment.fileSize,
    mimeType: attachment.mimeType,
    uploadedById: attachment.uploadedById,
    uploadedByName: attachment.uploadedBy?.name ?? "",
    createdAt: attachment.createdAt,
  };
}

function mapAssignee(
  assignee: {
    id: string;
    taskId: string;
    userId: string;
    user: { name: string; email: string };
    latestVersionId: string | null;
    latestVersion:
      | {
          id: string;
          assigneeId: string;
          version: number;
          fileName: string;
          originalFileName: string;
          storagePath: string;
          fileSize: number;
          mimeType: string;
          submittedById: string;
          submittedBy?: { name?: string | null };
          submittedAt: Date;
          note: string | null;
          isLate: boolean;
        }
      | null;
    submittedAt: Date | null;
    versions?: Array<unknown>;
    createdAt: Date;
    updatedAt: Date;
  },
  task: { dueAt: Date; status: "ACTIVE" | "CLOSED" },
  now: Date
): DocumentCollectionAssigneeItem {
  return {
    id: assignee.id,
    taskId: assignee.taskId,
    userId: assignee.userId,
    userName: assignee.user.name,
    userEmail: assignee.user.email,
    latestVersionId: assignee.latestVersionId,
    latestVersion: assignee.latestVersion
      ? {
          id: assignee.latestVersion.id,
          assigneeId: assignee.latestVersion.assigneeId,
          version: assignee.latestVersion.version,
          fileName: assignee.latestVersion.fileName,
          originalFileName: assignee.latestVersion.originalFileName,
          storagePath: `/api/collections/${assignee.taskId}/submissions/${assignee.latestVersion.id}/download`,
          fileSize: assignee.latestVersion.fileSize,
          mimeType: assignee.latestVersion.mimeType,
          submittedById: assignee.latestVersion.submittedById,
          submittedByName: assignee.latestVersion.submittedBy?.name ?? "",
          submittedAt: assignee.latestVersion.submittedAt,
          note: assignee.latestVersion.note,
          isLate: assignee.latestVersion.isLate,
        }
      : null,
    submittedAt: assignee.submittedAt,
    versionCount: assignee.versions?.length ?? 0,
    status: deriveDocumentCollectionSubmissionStatus({
      dueAt: task.dueAt,
      taskStatus: task.status,
      submittedAt: assignee.submittedAt,
      latestVersion: assignee.latestVersion
        ? { isLate: assignee.latestVersion.isLate }
        : null,
      now,
    }),
    createdAt: assignee.createdAt,
    updatedAt: assignee.updatedAt,
  };
}

function mapTaskListItem(
  task: {
    id: string;
    title: string;
    instruction: string;
    dueAt: Date;
    status: "ACTIVE" | "CLOSED";
    renameRule: string;
    renameVariables: Record<string, string>;
    createdById: string;
    createdBy?: { name?: string | null };
    createdAt: Date;
    updatedAt: Date;
    assignees: Array<Parameters<typeof mapAssignee>[0]>;
  },
  userId: string,
  now: Date
): DocumentCollectionTaskListItem {
  const assignees = task.assignees.map((assignee) => mapAssignee(assignee, task, now));
  const myAssignee = assignees.find((assignee) => assignee.userId === userId) ?? null;
  const latestActivityAt = assignees
    .map((assignee) => assignee.submittedAt ?? assignee.updatedAt)
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;

  return {
    id: task.id,
    title: task.title,
    instruction: task.instruction,
    dueAt: task.dueAt,
    status: task.status,
    renameRule: task.renameRule,
    renameVariables: task.renameVariables ?? {},
    createdById: task.createdById,
    createdByName: task.createdBy?.name ?? "",
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    assigneeCount: assignees.length,
    submittedCount: assignees.filter((assignee) => assignee.status === "SUBMITTED").length,
    pendingCount: assignees.filter((assignee) => assignee.status === "PENDING").length,
    lateCount: assignees.filter((assignee) => assignee.status === "LATE").length,
    latestActivityAt,
    myStatus: canManageDocumentCollectionTask({ createdById: task.createdById, userId })
      ? null
      : myAssignee?.status ?? null,
  };
}

export async function createDocumentCollectionTask(
  input: CreateTaskInput
): Promise<ServiceResult<DocumentCollectionTaskDetailView>> {
  try {
    const createdTask = await db.documentCollectionTask.create({
      data: {
        title: input.title,
        instruction: input.instruction,
        dueAt: input.dueAt,
        status: "ACTIVE",
        renameRule: input.renameRule,
        renameVariables: input.renameVariables,
        createdBy: {
          connect: { id: input.creatorId },
        },
        assignees: {
          createMany: {
            data: input.assigneeIds.map((userId) => ({ userId })),
          },
        },
      },
    });

    const savedAttachmentPaths: string[] = [];

    try {
      const attachments = input.attachments ?? [];

      if (attachments.length > 0) {
        const attachmentRecords = [];

        for (const attachment of attachments) {
          const fileMeta = await saveCollectionTaskAttachment(
            attachment.buffer,
            attachment.originalFileName,
            createdTask.id,
            attachment.id
          );
          savedAttachmentPaths.push(fileMeta.filePath);
          attachmentRecords.push({
            id: attachment.id,
            taskId: createdTask.id,
            fileName: fileMeta.fileName,
            originalFileName: attachment.originalFileName,
            storagePath: fileMeta.urlPath,
            fileSize: attachment.fileSize,
            mimeType: attachment.mimeType,
            uploadedById: input.creatorId,
          });
        }

        await db.documentCollectionAttachment.createMany({
          data: attachmentRecords,
        });
      }
    } catch (error) {
      await Promise.allSettled(savedAttachmentPaths.map((filePath) => deleteFile(filePath)));
      await db.documentCollectionTask.delete({
        where: { id: createdTask.id },
      });
      throw error;
    }

    const task = await db.documentCollectionTask.findFirst({
      where: {
        id: createdTask.id,
      },
      include: {
        createdBy: { select: { name: true } },
        attachments: { include: { uploadedBy: { select: { name: true } } } },
        assignees: {
          include: {
            user: { select: { name: true, email: true } },
            latestVersion: {
              include: {
                submittedBy: { select: { name: true } },
              },
            },
            versions: true,
          },
        },
      },
    });

    if (!task) {
      return { success: false, error: { code: "NOT_FOUND", message: "任务不存在" } };
    }

    const now = new Date();

    // 生成任务分配通知
    // 注意：此调用在事务外。通知创建失败不应阻断任务创建，这是有意为之的权衡。
    try {
      await createNotifications(
        input.assigneeIds.map((userId) => ({
          type: "TASK_ASSIGNED",
          title: "新收集任务",
          content: `${task.createdBy?.name ?? "未知用户"} 发起了收集任务「${task.title}」，请在 ${task.dueAt.toLocaleDateString("zh-CN")} 前提交`,
          taskId: task.id,
          recipientId: userId,
        }))
      );
    } catch {
      // 通知创建失败不阻断任务创建
    }

    return {
      success: true,
      data: {
        id: task.id,
        title: task.title,
        instruction: task.instruction,
        dueAt: task.dueAt,
        status: task.status,
        renameRule: task.renameRule,
        renameVariables: (task.renameVariables as Record<string, string> | null) ?? {},
        createdById: task.createdById,
        createdByName: task.createdBy?.name ?? "",
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        attachments: task.attachments.map(mapAttachment),
        assignees: task.assignees.map((assignee) => mapAssignee(assignee, task, now)),
        viewerRole: "creator",
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建任务失败";
    return { success: false, error: { code: "CREATE_FAILED", message } };
  }
}

export async function listDocumentCollectionTasks(
  input: ListTasksInput
): Promise<ServiceResult<DocumentCollectionTaskListItem[]>> {
  try {
    const now = input.now ?? new Date();
    const whereClauses: Array<Record<string, unknown>> = [];

    if (input.scope === "created") {
      whereClauses.push({ createdById: input.userId });
    } else if (input.scope === "assigned") {
      whereClauses.push({ assignees: { some: { userId: input.userId } } });
    } else {
      whereClauses.push({
        OR: [{ createdById: input.userId }, { assignees: { some: { userId: input.userId } } }],
      });
    }

    if (input.status) {
      whereClauses.push({ status: input.status === "active" ? "ACTIVE" : "CLOSED" });
    }

    if (input.search) {
      whereClauses.push({
        OR: [
          { title: { contains: input.search, mode: "insensitive" } },
          { instruction: { contains: input.search, mode: "insensitive" } },
        ],
      });
    }

    const tasks = await db.documentCollectionTask.findMany({
      where: whereClauses.length === 1 ? whereClauses[0] : { AND: whereClauses },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
        assignees: {
          include: {
            user: { select: { name: true, email: true } },
            latestVersion: {
              include: {
                submittedBy: { select: { name: true } },
              },
            },
            versions: { select: { id: true } },
          },
        },
      },
    });

    return {
      success: true,
      data: tasks.map((task) =>
        mapTaskListItem(
          {
            ...task,
            renameVariables: (task.renameVariables as Record<string, string> | null) ?? {},
          },
          input.userId,
          now
        )
      ),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取任务列表失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

export async function getDocumentCollectionTaskDetail(
  input: GetTaskDetailInput
): Promise<ServiceResult<DocumentCollectionTaskDetailView>> {
  try {
    const task = await db.documentCollectionTask.findFirst({
      where: { id: input.taskId },
      include: {
        createdBy: { select: { name: true } },
        attachments: {
          include: {
            uploadedBy: { select: { name: true } },
          },
        },
        assignees: {
          include: {
            user: { select: { name: true, email: true } },
            latestVersion: {
              include: {
                submittedBy: { select: { name: true } },
              },
            },
            versions: { select: { id: true } },
          },
        },
      },
    });

    if (!task) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "任务不存在" },
      };
    }

    const viewerRole = getDocumentCollectionViewerRole({
      createdById: task.createdById,
      assignees: task.assignees,
      userId: input.userId,
    });

    if (!viewerRole) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "任务不存在" },
      };
    }

    const now = input.now ?? new Date();
    const visibleAssignees =
      viewerRole === "creator"
        ? task.assignees
        : task.assignees.filter((assignee) => assignee.userId === input.userId);

    return {
      success: true,
      data: {
        id: task.id,
        title: task.title,
        instruction: task.instruction,
        dueAt: task.dueAt,
        status: task.status,
        renameRule: task.renameRule,
        renameVariables: (task.renameVariables as Record<string, string> | null) ?? {},
        createdById: task.createdById,
        createdByName: task.createdBy?.name ?? "",
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        attachments: task.attachments.map(mapAttachment),
        assignees: visibleAssignees.map((assignee) => mapAssignee(assignee, task, now)),
        viewerRole,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取任务详情失败";
    return { success: false, error: { code: "GET_FAILED", message } };
  }
}

export async function closeDocumentCollectionTask(
  input: CloseTaskInput
): Promise<ServiceResult<DocumentCollectionTaskDetailView>> {
  try {
    const task = await db.documentCollectionTask.findFirst({
      where: { id: input.taskId },
      select: { id: true, createdById: true },
    });

    if (!task || task.createdById !== input.userId) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "任务不存在" },
      };
    }

    await db.documentCollectionTask.update({
      where: { id: task.id },
      data: { status: "CLOSED" },
    });

    return getDocumentCollectionTaskDetail({
      taskId: task.id,
      userId: input.userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "关闭任务失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}
