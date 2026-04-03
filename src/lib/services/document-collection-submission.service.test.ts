import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = {
  documentCollectionAssignee: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  documentCollectionSubmissionVersion: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

const saveCollectionSubmissionFileMock = vi.fn();
const deleteFileMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/file.service", () => ({
  saveCollectionSubmissionFile: saveCollectionSubmissionFileMock,
  deleteFile: deleteFileMock,
}));

describe("document-collection-submission.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof dbMock) => unknown) => {
      return callback(dbMock);
    });
  });

  it("上传新版本会递增版本号、更新 latestVersionId，并处理 late submission", async () => {
    dbMock.documentCollectionAssignee.findFirst.mockResolvedValue({
      id: "asg-1",
      taskId: "task-1",
      userId: "user-1",
      task: {
        id: "task-1",
        dueAt: new Date("2026-04-02T12:00:00.000Z"),
        status: "ACTIVE",
      },
      latestVersion: {
        id: "ver-1",
        version: 1,
      },
    });
    saveCollectionSubmissionFileMock.mockResolvedValue({
      fileName: "ver-2.docx",
      filePath: "/tmp/ver-2.docx",
      urlPath: "/uploads/collections/submissions/ver-2.docx",
    });
    dbMock.documentCollectionSubmissionVersion.create.mockResolvedValue({
      id: "ver-2",
      assigneeId: "asg-1",
      version: 2,
      fileName: "ver-2.docx",
      originalFileName: "材料.docx",
      storagePath: "/uploads/collections/submissions/ver-2.docx",
      fileSize: 123,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      submittedById: "user-1",
      submittedBy: { name: "张三" },
      submittedAt: new Date("2026-04-02T12:30:00.000Z"),
      note: "补充说明",
      isLate: true,
    });
    dbMock.documentCollectionAssignee.update.mockResolvedValue({
      id: "asg-1",
      latestVersionId: "ver-2",
      submittedAt: new Date("2026-04-02T12:30:00.000Z"),
    });

    const service = await import("./document-collection-submission.service");
    const result = await service.submitDocumentCollectionVersion({
      taskId: "task-1",
      userId: "user-1",
      fileName: "材料.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 123,
      buffer: Buffer.from("docx"),
      note: "补充说明",
      now: new Date("2026-04-02T12:30:00.000Z"),
      versionId: "ver-2",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.storagePath).toBe("/api/collections/task-1/submissions/ver-2/download");
    }
    expect(saveCollectionSubmissionFileMock).toHaveBeenCalledWith(
      Buffer.from("docx"),
      "材料.docx",
      "ver-2"
    );
    expect(dbMock.documentCollectionSubmissionVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        assigneeId: "asg-1",
        version: 2,
        fileName: "ver-2.docx",
        originalFileName: "材料.docx",
        storagePath: "/uploads/collections/submissions/ver-2.docx",
        fileSize: 123,
        note: "补充说明",
        isLate: true,
      }),
      include: expect.any(Object),
    });
    expect(dbMock.documentCollectionAssignee.update).toHaveBeenCalledWith({
      where: { id: "asg-1" },
      data: {
        latestVersionId: "ver-2",
        submittedAt: new Date("2026-04-02T12:30:00.000Z"),
      },
    });
  });

  it("task 已关闭时禁止 assignee 上传新版本", async () => {
    dbMock.documentCollectionAssignee.findFirst.mockResolvedValue({
      id: "asg-1",
      taskId: "task-1",
      userId: "user-1",
      task: {
        id: "task-1",
        dueAt: new Date("2026-04-02T12:00:00.000Z"),
        status: "CLOSED",
      },
      latestVersion: {
        id: "ver-1",
        version: 1,
      },
    });

    const service = await import("./document-collection-submission.service");
    const result = await service.submitDocumentCollectionVersion({
      taskId: "task-1",
      userId: "user-1",
      fileName: "材料.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 123,
      buffer: Buffer.from("docx"),
      now: new Date("2026-04-02T11:00:00.000Z"),
      versionId: "ver-2",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TASK_CLOSED");
    }
  });

  it("非 assignee 上传新版本时返回 NOT_FOUND", async () => {
    dbMock.documentCollectionAssignee.findFirst.mockResolvedValue(null);

    const service = await import("./document-collection-submission.service");
    const result = await service.submitDocumentCollectionVersion({
      taskId: "task-1",
      userId: "user-2",
      fileName: "材料.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 123,
      buffer: Buffer.from("docx"),
      now: new Date("2026-04-02T11:00:00.000Z"),
      versionId: "ver-2",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("可读取版本历史", async () => {
    dbMock.documentCollectionAssignee.findFirst.mockResolvedValue({
      id: "asg-1",
      taskId: "task-1",
      userId: "user-1",
      task: {
        id: "task-1",
        dueAt: new Date("2026-04-02T12:00:00.000Z"),
        status: "ACTIVE",
        createdById: "creator-1",
      },
    });
    dbMock.documentCollectionSubmissionVersion.findMany.mockResolvedValue([
      {
        id: "ver-2",
        assigneeId: "asg-1",
        version: 2,
        fileName: "ver-2.docx",
        originalFileName: "材料-v2.docx",
        storagePath: "/uploads/collections/submissions/ver-2.docx",
        fileSize: 123,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        submittedById: "user-1",
        submittedBy: { name: "张三" },
        submittedAt: new Date("2026-04-02T11:00:00.000Z"),
        note: "第二版",
        isLate: false,
      },
      {
        id: "ver-1",
        assigneeId: "asg-1",
        version: 1,
        fileName: "ver-1.docx",
        originalFileName: "材料-v1.docx",
        storagePath: "/uploads/collections/submissions/ver-1.docx",
        fileSize: 120,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        submittedById: "user-1",
        submittedBy: { name: "张三" },
        submittedAt: new Date("2026-04-02T10:00:00.000Z"),
        note: null,
        isLate: false,
      },
    ]);

    const service = await import("./document-collection-submission.service");
    const result = await service.listDocumentCollectionSubmissionVersions({
      taskId: "task-1",
      userId: "user-1",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.map((item) => item.version)).toEqual([2, 1]);
  });

  it("事务失败时会清理已保存文件，避免孤儿文件", async () => {
    dbMock.documentCollectionAssignee.findFirst.mockResolvedValue({
      id: "asg-1",
      taskId: "task-1",
      userId: "user-1",
      task: {
        id: "task-1",
        dueAt: new Date("2026-04-02T12:00:00.000Z"),
        status: "ACTIVE",
      },
      latestVersion: null,
    });
    saveCollectionSubmissionFileMock.mockResolvedValue({
      fileName: "ver-1.docx",
      filePath: "/tmp/ver-1.docx",
      urlPath: "/uploads/collections/submissions/ver-1.docx",
    });
    dbMock.$transaction.mockRejectedValue(new Error("db failed"));

    const service = await import("./document-collection-submission.service");
    const result = await service.submitDocumentCollectionVersion({
      taskId: "task-1",
      userId: "user-1",
      fileName: "材料.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 123,
      buffer: Buffer.from("docx"),
      now: new Date("2026-04-02T11:00:00.000Z"),
      versionId: "ver-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("SUBMIT_FAILED");
    }
    expect(deleteFileMock).toHaveBeenCalledWith("/tmp/ver-1.docx");
  });

  it("事务失败后即使清理失败，也要稳定返回原始提交失败原因", async () => {
    dbMock.documentCollectionAssignee.findFirst.mockResolvedValue({
      id: "asg-1",
      taskId: "task-1",
      userId: "user-1",
      task: {
        id: "task-1",
        dueAt: new Date("2026-04-02T12:00:00.000Z"),
        status: "ACTIVE",
      },
      latestVersion: null,
    });
    saveCollectionSubmissionFileMock.mockResolvedValue({
      fileName: "ver-1.docx",
      filePath: "/tmp/ver-1.docx",
      urlPath: "/uploads/collections/submissions/ver-1.docx",
    });
    dbMock.$transaction.mockRejectedValue(new Error("db failed"));
    deleteFileMock.mockRejectedValue(new Error("cleanup failed"));

    const service = await import("./document-collection-submission.service");
    const result = await service.submitDocumentCollectionVersion({
      taskId: "task-1",
      userId: "user-1",
      fileName: "材料.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 123,
      buffer: Buffer.from("docx"),
      now: new Date("2026-04-02T11:00:00.000Z"),
      versionId: "ver-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("SUBMIT_FAILED");
      expect(result.error.message).toBe("db failed");
    }
  });
});
