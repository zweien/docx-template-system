import { join } from "path";
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = {
  documentCollectionTask: {
    findFirst: vi.fn(),
  },
};

const readFileMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("fs/promises", () => ({
  readFile: readFileMock,
  default: {
    readFile: readFileMock,
  },
}));

describe("document-collection-download.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("只允许 creator 打包下载，并且只取各 assignee 的 latestVersion", async () => {
    dbMock.documentCollectionTask.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "task-1",
        title: "季度资料收集",
        dueAt: new Date("2026-04-02T12:00:00.000Z"),
        renameRule: "{姓名}_{原始文件名}",
        renameVariables: { 部门: "研发" },
        createdById: "creator-1",
        assignees: [
          {
            id: "asg-1",
            user: { name: "张三", email: "zhangsan@example.com" },
            latestVersion: {
              id: "ver-2",
              version: 2,
              originalFileName: "报告.docx",
              storagePath: "/uploads/collections/submissions/ver-2.docx",
              submittedAt: new Date("2026-04-02T11:00:00.000Z"),
            },
            versions: [
              { id: "ver-1", storagePath: "/tmp/ver-1.docx" },
              { id: "ver-2", storagePath: "/uploads/collections/submissions/ver-2.docx" },
            ],
          },
        ],
      });
    readFileMock.mockResolvedValue(Buffer.from("latest"));

    const service = await import("./document-collection-download.service");

    const forbiddenResult = await service.downloadDocumentCollectionTaskArchive({
      taskId: "task-1",
      userId: "assignee-1",
    });
    expect(forbiddenResult.success).toBe(false);
    if (!forbiddenResult.success) {
      expect(forbiddenResult.error.code).toBe("NOT_FOUND");
    }

    const result = await service.downloadDocumentCollectionTaskArchive({
      taskId: "task-1",
      userId: "creator-1",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(readFileMock).toHaveBeenCalledTimes(1);
    expect(readFileMock).toHaveBeenCalledWith(
      join(process.cwd(), "public/uploads/collections/submissions/ver-2.docx")
    );
    const zip = await JSZip.loadAsync(result.data.buffer);
    expect(Object.keys(zip.files)).toContain("张三_报告.docx");
  });

  it("空任务报错", async () => {
    dbMock.documentCollectionTask.findFirst.mockResolvedValue({
      id: "task-1",
      title: "季度资料收集",
      dueAt: new Date("2026-04-02T12:00:00.000Z"),
      renameRule: "{姓名}_{原始文件名}",
      renameVariables: {},
      createdById: "creator-1",
      assignees: [],
    });

    const service = await import("./document-collection-download.service");
    const result = await service.downloadDocumentCollectionTaskArchive({
      taskId: "task-1",
      userId: "creator-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("EMPTY_TASK");
    }
  });

  it("有 assignees 但都没有 latestVersion 时也返回 EMPTY_TASK", async () => {
    dbMock.documentCollectionTask.findFirst.mockResolvedValue({
      id: "task-1",
      title: "季度资料收集",
      dueAt: new Date("2026-04-02T12:00:00.000Z"),
      renameRule: "{姓名}_{原始文件名}",
      renameVariables: {},
      createdById: "creator-1",
      assignees: [
        {
          id: "asg-1",
          user: { name: "张三", email: "zhangsan@example.com" },
          latestVersion: null,
        },
        {
          id: "asg-2",
          user: { name: "李四", email: "lisi@example.com" },
          latestVersion: undefined,
        },
      ],
    });

    const service = await import("./document-collection-download.service");
    const result = await service.downloadDocumentCollectionTaskArchive({
      taskId: "task-1",
      userId: "creator-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("EMPTY_TASK");
    }
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("任务不存在时返回 NOT_FOUND", async () => {
    dbMock.documentCollectionTask.findFirst.mockResolvedValue(null);

    const service = await import("./document-collection-download.service");
    const result = await service.downloadDocumentCollectionTaskArchive({
      taskId: "task-missing",
      userId: "creator-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("重名文件会使用现有去重工具处理", async () => {
    dbMock.documentCollectionTask.findFirst.mockResolvedValue({
      id: "task-1",
      title: "季度资料收集",
      dueAt: new Date("2026-04-02T12:00:00.000Z"),
      renameRule: "{原始文件名}",
      renameVariables: {},
      createdById: "creator-1",
      assignees: [
        {
          id: "asg-1",
          user: { name: "张三", email: "zhangsan@example.com" },
          latestVersion: {
            id: "ver-1",
            version: 1,
            originalFileName: "报告.docx",
            storagePath: "/uploads/collections/submissions/ver-1.docx",
            submittedAt: new Date("2026-04-02T11:00:00.000Z"),
          },
        },
        {
          id: "asg-2",
          user: { name: "李四", email: "lisi@example.com" },
          latestVersion: {
            id: "ver-2",
            version: 1,
            originalFileName: "报告.docx",
            storagePath: "/uploads/collections/submissions/ver-2.docx",
            submittedAt: new Date("2026-04-02T11:10:00.000Z"),
          },
        },
      ],
    });
    readFileMock.mockResolvedValue(Buffer.from("content"));

    const service = await import("./document-collection-download.service");
    const result = await service.downloadDocumentCollectionTaskArchive({
      taskId: "task-1",
      userId: "creator-1",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    const zip = await JSZip.loadAsync(result.data.buffer);
    expect(Object.keys(zip.files)).toEqual(["报告.docx", "报告 (2).docx"]);
  });

  it("创建者和指定提交人可下载任务参考附件，其他人返回 NOT_FOUND", async () => {
    dbMock.documentCollectionTask.findFirst
      .mockResolvedValueOnce({
        id: "task-1",
        createdById: "creator-1",
        assignees: [{ userId: "user-1" }],
        attachments: [
          {
            id: "att-1",
            originalFileName: "说明.pdf",
            storagePath: "/uploads/collections/tasks/task-1/att-1.pdf",
            mimeType: "application/pdf",
          },
        ],
      })
      .mockResolvedValueOnce({
        id: "task-1",
        createdById: "creator-1",
        assignees: [{ userId: "user-1" }],
        attachments: [
          {
            id: "att-1",
            originalFileName: "说明.pdf",
            storagePath: "/uploads/collections/tasks/task-1/att-1.pdf",
            mimeType: "application/pdf",
          },
        ],
      });
    readFileMock.mockResolvedValue(Buffer.from("attachment"));

    const service = await import("./document-collection-download.service");
    const ownerResult = await service.downloadDocumentCollectionAttachment({
      taskId: "task-1",
      attachmentId: "att-1",
      userId: "creator-1",
    });
    const outsiderResult = await service.downloadDocumentCollectionAttachment({
      taskId: "task-1",
      attachmentId: "att-1",
      userId: "other-user",
    });

    expect(ownerResult.success).toBe(true);
    if (ownerResult.success) {
      expect(ownerResult.data.fileName).toBe("说明.pdf");
      expect(ownerResult.data.mimeType).toBe("application/pdf");
      expect(ownerResult.data.buffer.toString()).toBe("attachment");
    }
    expect(outsiderResult.success).toBe(false);
    if (!outsiderResult.success) {
      expect(outsiderResult.error.code).toBe("NOT_FOUND");
    }
  });

  it("创建者和版本所属提交人可下载单个提交版本", async () => {
    dbMock.documentCollectionTask.findFirst.mockResolvedValue({
      id: "task-1",
      createdById: "creator-1",
      assignees: [
        {
          id: "asg-1",
          userId: "user-1",
          versions: [
            {
              id: "ver-1",
              originalFileName: "材料.docx",
              storagePath: "/uploads/collections/submissions/ver-1.docx",
              mimeType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            },
          ],
        },
      ],
    });
    readFileMock.mockResolvedValue(Buffer.from("version-content"));

    const service = await import("./document-collection-download.service");
    const result = await service.downloadDocumentCollectionSubmissionVersion({
      taskId: "task-1",
      versionId: "ver-1",
      userId: "user-1",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fileName).toBe("材料.docx");
      expect(result.data.buffer.toString()).toBe("version-content");
    }
  });
});
