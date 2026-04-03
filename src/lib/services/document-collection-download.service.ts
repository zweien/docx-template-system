import { readFile } from "fs/promises";
import JSZip from "jszip";
import { db } from "@/lib/db";
import { resolveStoredFilePath } from "@/lib/file.service";
import { buildDocumentCollectionFileName } from "@/lib/utils/document-collection-file-name";
import { generateUniqueFileName } from "@/lib/utils/file-name-builder";
import type { ServiceResult } from "@/types/data-table";

type DownloadArchiveInput = {
  taskId: string;
  userId: string;
};

type DownloadArchiveResult = {
  fileName: string;
  buffer: Buffer;
};

type DownloadAttachmentInput = {
  taskId: string;
  attachmentId: string;
  userId: string;
};

type DownloadSubmissionVersionInput = {
  taskId: string;
  versionId: string;
  userId: string;
};

type DownloadBinaryResult = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

export async function downloadDocumentCollectionTaskArchive(
  input: DownloadArchiveInput
): Promise<ServiceResult<DownloadArchiveResult>> {
  try {
    const task = await db.documentCollectionTask.findFirst({
      where: {
        id: input.taskId,
      },
      include: {
        assignees: {
          include: {
            user: { select: { name: true, email: true } },
            latestVersion: true,
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

    if (task.createdById !== input.userId) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "任务不存在" },
      };
    }

    const latestVersions = task.assignees.filter((assignee) => assignee.latestVersion);
    if (latestVersions.length === 0) {
      return {
        success: false,
        error: { code: "EMPTY_TASK", message: "任务下没有可下载的提交文件" },
      };
    }

    const zip = new JSZip();
    const existingNames = new Set<string>();

    for (let index = 0; index < latestVersions.length; index += 1) {
      const assignee = latestVersions[index];
      const version = assignee.latestVersion;
      if (!version) {
        continue;
      }

      const preferredName = buildDocumentCollectionFileName(task.renameRule, {
        sequence: index + 1,
        submittedAt: version.submittedAt,
        taskTitle: task.title,
        name: assignee.user.name,
        email: assignee.user.email,
        originalFileName: version.originalFileName,
        version: version.version,
        taskVariables: task.renameVariables as Record<string, string>,
      });
      const uniqueName = generateUniqueFileName(preferredName, existingNames);
      existingNames.add(uniqueName);
      zip.file(uniqueName, await readFile(resolveStoredFilePath(version.storagePath)));
    }

    return {
      success: true,
      data: {
        fileName: `${task.title}.zip`,
        buffer: await zip.generateAsync({ type: "nodebuffer" }),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "打包下载失败";
    return { success: false, error: { code: "DOWNLOAD_FAILED", message } };
  }
}

export async function downloadDocumentCollectionAttachment(
  input: DownloadAttachmentInput
): Promise<ServiceResult<DownloadBinaryResult>> {
  try {
    const task = await db.documentCollectionTask.findFirst({
      where: { id: input.taskId },
      include: {
        attachments: {
          where: { id: input.attachmentId },
        },
        assignees: {
          select: { userId: true },
        },
      },
    });

    const attachment = task?.attachments[0] ?? null;
    const canDownload =
      task &&
      (task.createdById === input.userId ||
        task.assignees.some((assignee) => assignee.userId === input.userId));

    if (!task || !attachment || !canDownload) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "任务不存在" },
      };
    }

    return {
      success: true,
      data: {
        fileName: attachment.originalFileName,
        mimeType: attachment.mimeType,
        buffer: await readFile(resolveStoredFilePath(attachment.storagePath)),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "下载附件失败";
    return { success: false, error: { code: "DOWNLOAD_FAILED", message } };
  }
}

export async function downloadDocumentCollectionSubmissionVersion(
  input: DownloadSubmissionVersionInput
): Promise<ServiceResult<DownloadBinaryResult>> {
  try {
    const task = await db.documentCollectionTask.findFirst({
      where: { id: input.taskId },
      include: {
        assignees: {
          include: {
            versions: {
              where: { id: input.versionId },
            },
          },
        },
      },
    });

    const assignee = task?.assignees.find((item) => item.versions.length > 0) ?? null;
    const version = assignee?.versions[0] ?? null;
    const canDownload =
      task &&
      assignee &&
      (task.createdById === input.userId || assignee.userId === input.userId);

    if (!task || !assignee || !version || !canDownload) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "任务不存在" },
      };
    }

    return {
      success: true,
      data: {
        fileName: version.originalFileName,
        mimeType: version.mimeType,
        buffer: await readFile(resolveStoredFilePath(version.storagePath)),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "下载提交版本失败";
    return { success: false, error: { code: "DOWNLOAD_FAILED", message } };
  }
}
