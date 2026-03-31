import { saveUploadedFile } from "@/lib/file.service";
import { db } from "@/lib/db";
import { readFile } from "fs/promises";
import { extractTextFromBuffer } from "@/lib/attachments/extract-text";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

interface SaveAttachmentInput {
  id: string;
  userId: string;
  fileName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}

interface CompleteAttachmentExtractionInput {
  attachmentId: string;
  extractedText: string;
  extractSummary: string;
}

interface FailAttachmentExtractionInput {
  attachmentId: string;
  extractError: string;
}

interface AttachmentRecordLike {
  id: string;
  userId: string;
  fileName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  extractStatus: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  extractedText?: string | null;
  extractSummary?: string | null;
  extractError?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

function getAiAttachmentDelegate() {
  const delegate = (db as unknown as {
    aiAttachment?: {
      create: (args: unknown) => Promise<unknown>;
      findUnique: (args: unknown) => Promise<unknown>;
      findMany: (args: unknown) => Promise<unknown[]>;
      update: (args: unknown) => Promise<unknown>;
    };
  }).aiAttachment;

  if (!delegate) {
    throw new Error("Prisma aiAttachment delegate 不可用");
  }

  return delegate;
}

function normalizeAttachmentRecord(attachment: AttachmentRecordLike) {
  return {
    ...attachment,
    extractStatus: attachment.extractStatus.toLowerCase(),
  };
}

export async function getAttachment(
  attachmentId: string
): Promise<ServiceResult<unknown>> {
  const aiAttachment = getAiAttachmentDelegate();
  const attachment = await aiAttachment.findUnique({
    where: { id: attachmentId },
  });

  if (!attachment) {
    return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "附件不存在",
      },
    };
  }

  return { success: true, data: normalizeAttachmentRecord(attachment as AttachmentRecordLike) };
}

export async function listAttachmentsByIds(
  attachmentIds: string[]
): Promise<ServiceResult<unknown[]>> {
  if (attachmentIds.length === 0) {
    return { success: true, data: [] };
  }

  const aiAttachment = getAiAttachmentDelegate();
  const attachments = (await aiAttachment.findMany({
    where: {
      id: {
        in: attachmentIds,
      },
    },
  })) as AttachmentRecordLike[];

  return {
    success: true,
    data: attachments.map(normalizeAttachmentRecord),
  };
}

export async function saveAttachment(
  input: SaveAttachmentInput
): Promise<ServiceResult<unknown>> {
  const aiAttachment = getAiAttachmentDelegate();
  const stored = await saveUploadedFile(
    input.buffer,
    input.fileName,
    "documents",
    input.id
  );

  const attachment = await aiAttachment.create({
    data: {
      id: input.id,
      userId: input.userId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      size: input.size,
      storagePath: stored.filePath,
      extractStatus: "PENDING",
    },
  });

  return { success: true, data: normalizeAttachmentRecord(attachment as AttachmentRecordLike) };
}

export async function completeAttachmentExtraction(
  input: CompleteAttachmentExtractionInput
): Promise<ServiceResult<unknown>> {
  const aiAttachment = getAiAttachmentDelegate();
  const attachment = await aiAttachment.update({
    where: { id: input.attachmentId },
    data: {
      extractStatus: "COMPLETED",
      extractedText: input.extractedText,
      extractSummary: input.extractSummary,
    },
  });

  return { success: true, data: normalizeAttachmentRecord(attachment as AttachmentRecordLike) };
}

export async function failAttachmentExtraction(
  input: FailAttachmentExtractionInput
): Promise<ServiceResult<unknown>> {
  const aiAttachment = getAiAttachmentDelegate();
  const attachment = await aiAttachment.update({
    where: { id: input.attachmentId },
    data: {
      extractStatus: "FAILED",
      extractError: input.extractError,
    },
  });

  return { success: true, data: normalizeAttachmentRecord(attachment as AttachmentRecordLike) };
}

export async function processAttachmentExtraction(
  attachmentId: string
): Promise<ServiceResult<unknown>> {
  const aiAttachment = getAiAttachmentDelegate();
  const attachment = (await aiAttachment.findUnique({
    where: { id: attachmentId },
  })) as AttachmentRecordLike | null;

  if (!attachment) {
    return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "附件不存在",
      },
    };
  }

  await aiAttachment.update({
    where: { id: attachmentId },
    data: {
      extractStatus: "PROCESSING",
    },
  });

  try {
    const buffer = await readFile(attachment.storagePath);
    const extracted = await extractTextFromBuffer({
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      buffer,
    });

    if (!extracted.success) {
      const result = await failAttachmentExtraction({
        attachmentId,
        extractError: extracted.error.message,
      });

      if (!result.success) {
        return result;
      }

      return result;
    }

    const result = await completeAttachmentExtraction({
      attachmentId,
      extractedText: extracted.data.text,
      extractSummary: extracted.data.summary,
    });

    return result;
  } catch (error) {
    const result = await failAttachmentExtraction({
      attachmentId,
      extractError: error instanceof Error ? error.message : "附件抽取失败",
    });

    return result;
  }
}
