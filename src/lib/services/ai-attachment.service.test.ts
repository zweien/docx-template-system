import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = {
  aiAttachment: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

const saveUploadedFileMock = vi.fn();
const readFileMock = vi.fn();
const extractTextFromBufferMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/file.service", () => ({
  saveUploadedFile: saveUploadedFileMock,
}));

vi.mock("fs/promises", () => ({
  readFile: readFileMock,
  default: {
    readFile: readFileMock,
  },
}));

vi.mock("@/lib/attachments/extract-text", () => ({
  extractTextFromBuffer: extractTextFromBufferMock,
}));

describe("ai-attachment.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saveAttachment 应保存文件并写入 pending 附件记录", async () => {
    saveUploadedFileMock.mockResolvedValue({
      fileName: "att-1.txt",
      filePath: "/tmp/att-1.txt",
      urlPath: "/uploads/documents/att-1.txt",
    });
    dbMock.aiAttachment.create.mockResolvedValue({
      id: "att-1",
      fileName: "note.txt",
      mimeType: "text/plain",
      extractStatus: "PENDING",
    });

    const service = await import("./ai-attachment.service");
    const result = await service.saveAttachment({
      id: "att-1",
      userId: "user-1",
      fileName: "note.txt",
      mimeType: "text/plain",
      size: 7,
      buffer: Buffer.from("内容", "utf-8"),
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.extractStatus).toBe("pending");
    expect(saveUploadedFileMock).toHaveBeenCalled();
    expect(dbMock.aiAttachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "att-1",
        userId: "user-1",
        fileName: "note.txt",
        mimeType: "text/plain",
        extractStatus: "PENDING",
      }),
    });
  });

  it("processAttachmentExtraction 应标记 PROCESSING 并完成抽取", async () => {
    dbMock.aiAttachment.findUnique = vi.fn().mockResolvedValue({
      id: "att-1",
      userId: "user-1",
      fileName: "note.txt",
      mimeType: "text/plain",
      size: 7,
      storagePath: "/tmp/att-1.txt",
      extractStatus: "PENDING",
    });
    dbMock.aiAttachment.update = vi
      .fn()
      .mockResolvedValueOnce({
        id: "att-1",
        extractStatus: "PROCESSING",
      })
      .mockResolvedValueOnce({
        id: "att-1",
        extractStatus: "COMPLETED",
        extractSummary: "摘要",
      });
    readFileMock.mockResolvedValue(Buffer.from("完整文本", "utf-8"));
    extractTextFromBufferMock.mockResolvedValue({
      success: true,
      data: {
        text: "完整文本",
        summary: "摘要",
      },
    });

    const service = await import("./ai-attachment.service");
    const result = await service.processAttachmentExtraction("att-1");

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(dbMock.aiAttachment.update).toHaveBeenNthCalledWith(1, {
      where: { id: "att-1" },
      data: { extractStatus: "PROCESSING" },
    });
    expect(dbMock.aiAttachment.update).toHaveBeenNthCalledWith(2, {
      where: { id: "att-1" },
      data: {
        extractStatus: "COMPLETED",
        extractedText: "完整文本",
        extractSummary: "摘要",
      },
    });
    expect(result.data.extractStatus).toBe("completed");
  });

  it("completeAttachmentExtraction 应更新摘要和完成状态", async () => {
    dbMock.aiAttachment.update.mockResolvedValue({
      id: "att-1",
      extractStatus: "COMPLETED",
      extractSummary: "摘要",
    });

    const service = await import("./ai-attachment.service");
    const result = await service.completeAttachmentExtraction({
      attachmentId: "att-1",
      extractedText: "完整文本",
      extractSummary: "摘要",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.extractStatus).toBe("completed");
    expect(dbMock.aiAttachment.update).toHaveBeenCalledWith({
      where: { id: "att-1" },
      data: {
        extractStatus: "COMPLETED",
        extractedText: "完整文本",
        extractSummary: "摘要",
      },
    });
  });

  it("failAttachmentExtraction 应记录失败原因", async () => {
    dbMock.aiAttachment.update.mockResolvedValue({
      id: "att-1",
      extractStatus: "FAILED",
      extractError: "解析失败",
    });

    const service = await import("./ai-attachment.service");
    const result = await service.failAttachmentExtraction({
      attachmentId: "att-1",
      extractError: "解析失败",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.extractStatus).toBe("failed");
    expect(dbMock.aiAttachment.update).toHaveBeenCalledWith({
      where: { id: "att-1" },
      data: {
        extractStatus: "FAILED",
        extractError: "解析失败",
      },
    });
  });
});
