import { db } from "@/lib/db";
import { deleteFile, saveCollectionSubmissionFile } from "@/lib/file.service";
import type { ServiceResult } from "@/types/data-table";
import type { DocumentCollectionVersionItem } from "@/types/document-collection";

type SubmitVersionInput = {
  taskId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
  note?: string;
  now?: Date;
  versionId: string;
};

type ListVersionsInput = {
  taskId: string;
  userId: string;
  assigneeId?: string;
};

function mapVersion(
  taskId: string,
  version: {
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
): DocumentCollectionVersionItem {
  return {
    id: version.id,
    assigneeId: version.assigneeId,
    version: version.version,
    fileName: version.fileName,
    originalFileName: version.originalFileName,
    storagePath: `/api/collections/${taskId}/submissions/${version.id}/download`,
    fileSize: version.fileSize,
    mimeType: version.mimeType,
    submittedById: version.submittedById,
    submittedByName: version.submittedBy?.name ?? "",
    submittedAt: version.submittedAt,
    note: version.note,
    isLate: version.isLate,
  };
}

export async function submitDocumentCollectionVersion(
  input: SubmitVersionInput
): Promise<ServiceResult<DocumentCollectionVersionItem>> {
  let savedFilePath: string | null = null;

  try {
    const assignee = await db.documentCollectionAssignee.findFirst({
      where: {
        taskId: input.taskId,
        userId: input.userId,
      },
      include: {
        task: true,
        latestVersion: true,
      },
    });

    if (!assignee) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "任务不存在" },
      };
    }

    if (assignee.task.status === "CLOSED") {
      return {
        success: false,
        error: { code: "TASK_CLOSED", message: "任务已关闭，无法提交" },
      };
    }

    const submittedAt = input.now ?? new Date();
    const fileMeta = await saveCollectionSubmissionFile(
      input.buffer,
      input.fileName,
      input.versionId
    );
    savedFilePath = fileMeta.filePath;
    const nextVersion = (assignee.latestVersion?.version ?? 0) + 1;
    const isLate = assignee.task.dueAt.getTime() < submittedAt.getTime();

    const createdVersion = await db.$transaction(async (tx) => {
      const version = await tx.documentCollectionSubmissionVersion.create({
        data: {
          id: input.versionId,
          assigneeId: assignee.id,
          version: nextVersion,
          fileName: fileMeta.fileName,
          originalFileName: input.fileName,
          storagePath: fileMeta.urlPath,
          fileSize: input.size,
          mimeType: input.mimeType,
          submittedById: input.userId,
          submittedAt,
          note: input.note?.trim() || null,
          isLate,
        },
        include: {
          submittedBy: { select: { name: true } },
        },
      });

      await tx.documentCollectionAssignee.update({
        where: { id: assignee.id },
        data: {
          latestVersionId: version.id,
          submittedAt,
        },
      });

      return version;
    });

    return {
      success: true,
      data: mapVersion(assignee.taskId, createdVersion),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传版本失败";
    if (savedFilePath) {
      try {
        await deleteFile(savedFilePath);
      } catch {
        // 清理失败不能覆盖原始提交失败结果。
      }
    }
    return { success: false, error: { code: "SUBMIT_FAILED", message } };
  }
}

export async function listDocumentCollectionSubmissionVersions(
  input: ListVersionsInput
): Promise<ServiceResult<DocumentCollectionVersionItem[]>> {
  try {
    const assignee = await db.documentCollectionAssignee.findFirst({
      where: {
        taskId: input.taskId,
        ...(input.assigneeId
          ? { id: input.assigneeId }
          : { userId: input.userId }),
      },
      include: {
        task: true,
      },
    });

    if (!assignee) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "任务不存在" },
      };
    }

    if (assignee.userId !== input.userId && assignee.task.createdById !== input.userId) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "任务不存在" },
      };
    }

    const versions = await db.documentCollectionSubmissionVersion.findMany({
      where: { assigneeId: assignee.id },
      orderBy: [{ version: "desc" }],
      include: {
        submittedBy: { select: { name: true } },
      },
    });

    return {
      success: true,
      data: versions.map((version) => mapVersion(assignee.taskId, version)),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取版本历史失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}
