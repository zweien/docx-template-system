import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = {
  $transaction: vi.fn(),
  documentCollectionTask: {
    create: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  documentCollectionAttachment: {
    createMany: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

const saveCollectionTaskAttachmentMock = vi.fn();
const deleteFileMock = vi.fn();

vi.mock("@/lib/file.service", () => ({
  saveCollectionTaskAttachment: saveCollectionTaskAttachmentMock,
  deleteFile: deleteFileMock,
}));

describe("document-collection-task.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creator/assignee 权限判断与状态推导应正确", async () => {
    const permissionService = await import("./document-collection-permission.service");

    expect(
      permissionService.getDocumentCollectionViewerRole({
        createdById: "creator-1",
        assignees: [{ userId: "assignee-1" }],
        userId: "creator-1",
      })
    ).toBe("creator");

    expect(
      permissionService.getDocumentCollectionViewerRole({
        createdById: "creator-1",
        assignees: [{ userId: "assignee-1" }],
        userId: "assignee-1",
      })
    ).toBe("assignee");

    expect(
      permissionService.getDocumentCollectionViewerRole({
        createdById: "creator-1",
        assignees: [{ userId: "assignee-1" }],
        userId: "other-user",
      })
    ).toBeNull();

    expect(
      permissionService.deriveDocumentCollectionSubmissionStatus({
        dueAt: new Date("2026-04-02T12:00:00.000Z"),
        taskStatus: "ACTIVE",
        submittedAt: null,
        latestVersion: null,
        now: new Date("2026-04-02T10:00:00.000Z"),
      })
    ).toBe("PENDING");

    expect(
      permissionService.deriveDocumentCollectionSubmissionStatus({
        dueAt: new Date("2026-04-02T12:00:00.000Z"),
        taskStatus: "ACTIVE",
        submittedAt: new Date("2026-04-02T11:00:00.000Z"),
        latestVersion: { isLate: false },
        now: new Date("2026-04-02T12:30:00.000Z"),
      })
    ).toBe("SUBMITTED");

    expect(
      permissionService.deriveDocumentCollectionSubmissionStatus({
        dueAt: new Date("2026-04-02T12:00:00.000Z"),
        taskStatus: "ACTIVE",
        submittedAt: null,
        latestVersion: null,
        now: new Date("2026-04-02T13:00:00.000Z"),
      })
    ).toBe("PENDING");

    expect(
      permissionService.deriveDocumentCollectionSubmissionStatus({
        dueAt: new Date("2026-04-02T12:00:00.000Z"),
        taskStatus: "ACTIVE",
        submittedAt: new Date("2026-04-02T13:00:00.000Z"),
        latestVersion: { isLate: true },
        now: new Date("2026-04-02T13:00:01.000Z"),
      })
    ).toBe("LATE");

    expect(
      permissionService.canManageDocumentCollectionTask({
        createdById: "creator-1",
        userId: "creator-1",
      })
    ).toBe(true);
    expect(
      permissionService.canManageDocumentCollectionTask({
        createdById: "creator-1",
        userId: "assignee-1",
      })
    ).toBe(false);
  });

  it("创建任务会创建 assignee 并保存附件", async () => {
    dbMock.documentCollectionTask.create.mockResolvedValue({
      id: "task-1",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    });
    saveCollectionTaskAttachmentMock.mockResolvedValue({
      fileName: "att-1.pdf",
      filePath: "/tmp/att-1.pdf",
      urlPath: "/uploads/collections/tasks/task-1/att-1.pdf",
    });
    dbMock.documentCollectionAttachment.createMany.mockResolvedValue({ count: 1 });
    dbMock.documentCollectionTask.findFirst.mockResolvedValue({
      id: "task-1",
      title: "季度资料收集",
      instruction: "请上传文档",
      dueAt: new Date("2026-04-10T10:00:00.000Z"),
      status: "ACTIVE",
      renameRule: "{姓名}_{原始文件名}",
      renameVariables: { 部门: "研发" },
      createdById: "creator-1",
      createdBy: { name: "创建者" },
      assignees: [
        {
          id: "asg-1",
          taskId: "task-1",
          userId: "user-1",
          user: { name: "张三", email: "zhangsan@example.com" },
          latestVersionId: null,
          latestVersion: null,
          submittedAt: null,
          versions: [],
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-01T00:00:00.000Z"),
        },
        {
          id: "asg-2",
          taskId: "task-1",
          userId: "user-2",
          user: { name: "李四", email: "lisi@example.com" },
          latestVersionId: null,
          latestVersion: null,
          submittedAt: null,
          versions: [],
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-01T00:00:00.000Z"),
        },
      ],
      attachments: [
        {
          id: "att-1",
          taskId: "task-1",
          fileName: "att-1.pdf",
          originalFileName: "要求说明.pdf",
          storagePath: "/uploads/collections/tasks/task-1/att-1.pdf",
          fileSize: 1234,
          mimeType: "application/pdf",
          uploadedById: "creator-1",
          uploadedBy: { name: "创建者" },
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
        },
      ],
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    });

    const service = await import("./document-collection-task.service");
    const result = await service.createDocumentCollectionTask({
      creatorId: "creator-1",
      title: "季度资料收集",
      instruction: "请上传文档",
      dueAt: new Date("2026-04-10T10:00:00.000Z"),
      assigneeIds: ["user-1", "user-2"],
      renameRule: "{姓名}_{原始文件名}",
      renameVariables: { 部门: "研发" },
      attachments: [
        {
          id: "att-1",
          originalFileName: "要求说明.pdf",
          mimeType: "application/pdf",
          fileSize: 1234,
          buffer: Buffer.from("pdf"),
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(dbMock.documentCollectionTask.create).toHaveBeenCalledWith({
      data: {
        title: "季度资料收集",
        instruction: "请上传文档",
        dueAt: new Date("2026-04-10T10:00:00.000Z"),
        status: "ACTIVE",
        renameRule: "{姓名}_{原始文件名}",
        renameVariables: { 部门: "研发" },
        createdBy: {
          connect: { id: "creator-1" },
        },
        assignees: {
          createMany: {
            data: [{ userId: "user-1" }, { userId: "user-2" }],
          },
        },
      },
    });
    expect(dbMock.documentCollectionTask.findFirst).toHaveBeenCalledWith({
      where: {
        id: "task-1",
      },
      include: expect.any(Object),
    });
    expect(saveCollectionTaskAttachmentMock).toHaveBeenCalledWith(
      Buffer.from("pdf"),
      "要求说明.pdf",
      "task-1",
      "att-1"
    );
    expect(dbMock.documentCollectionAttachment.createMany).toHaveBeenCalledWith({
      data: [
        {
          id: "att-1",
          taskId: "task-1",
          fileName: "att-1.pdf",
          originalFileName: "要求说明.pdf",
          storagePath: "/uploads/collections/tasks/task-1/att-1.pdf",
          fileSize: 1234,
          mimeType: "application/pdf",
          uploadedById: "creator-1",
        },
      ],
    });
  });

  it("列表统计 submitted/pending/late", async () => {
    dbMock.documentCollectionTask.findMany.mockResolvedValue([
      {
        id: "task-1",
        title: "收集任务",
        instruction: "说明",
        dueAt: new Date("2026-04-02T12:00:00.000Z"),
        status: "ACTIVE",
        renameRule: "{姓名}",
        renameVariables: {},
        createdById: "creator-1",
        createdBy: { name: "创建者" },
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
        assignees: [
          {
            id: "asg-1",
            userId: "user-1",
            user: { name: "张三", email: "zhangsan@example.com" },
            latestVersionId: "ver-1",
            latestVersion: {
              id: "ver-1",
              version: 1,
              isLate: false,
              submittedAt: new Date("2026-04-02T11:00:00.000Z"),
            },
            submittedAt: new Date("2026-04-02T11:00:00.000Z"),
            versions: [{ id: "ver-1" }],
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-02T11:00:00.000Z"),
          },
          {
            id: "asg-2",
            userId: "user-2",
            user: { name: "李四", email: "lisi@example.com" },
            latestVersionId: null,
            latestVersion: null,
            submittedAt: null,
            versions: [],
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          },
          {
            id: "asg-3",
            userId: "user-3",
            user: { name: "王五", email: "wangwu@example.com" },
            latestVersionId: null,
            latestVersion: null,
            submittedAt: null,
            versions: [],
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          },
        ],
      },
    ]);

    const service = await import("./document-collection-task.service");
    const result = await service.listDocumentCollectionTasks({
      userId: "creator-1",
      scope: "created",
      now: new Date("2026-04-02T13:00:00.000Z"),
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data).toEqual([
      expect.objectContaining({
        assigneeCount: 3,
        submittedCount: 1,
        pendingCount: 2,
        lateCount: 0,
        myStatus: null,
      }),
    ]);
  });

  it("scope=all + search 时不应因 OR 覆盖权限过滤", async () => {
    dbMock.documentCollectionTask.findMany.mockResolvedValue([]);

    const service = await import("./document-collection-task.service");
    await service.listDocumentCollectionTasks({
      userId: "user-1",
      scope: "all",
      search: "季度",
      now: new Date("2026-04-02T13:00:00.000Z"),
    });

    expect(dbMock.documentCollectionTask.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            OR: [
              { createdById: "user-1" },
              { assignees: { some: { userId: "user-1" } } },
            ],
          },
          {
            OR: [
              { title: { contains: "季度", mode: "insensitive" } },
              { instruction: { contains: "季度", mode: "insensitive" } },
            ],
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: expect.any(Object),
    });
  });

  it("详情按 viewerRole 分 creator/assignee，不可见任务按 NOT_FOUND 返回", async () => {
    dbMock.documentCollectionTask.findFirst
      .mockResolvedValueOnce({
        id: "task-1",
        title: "收集任务",
        instruction: "说明",
        dueAt: new Date("2026-04-02T12:00:00.000Z"),
        status: "ACTIVE",
        renameRule: "{姓名}",
        renameVariables: {},
        createdById: "creator-1",
        createdBy: { name: "创建者" },
        attachments: [],
        assignees: [
          {
            id: "asg-1",
            taskId: "task-1",
            userId: "user-1",
            user: { name: "张三", email: "zhangsan@example.com" },
            latestVersionId: "ver-1",
            latestVersion: {
              id: "ver-1",
              assigneeId: "asg-1",
              version: 1,
              fileName: "v1.docx",
              originalFileName: "原件.docx",
              storagePath: "/tmp/v1.docx",
              fileSize: 100,
              mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              submittedById: "user-1",
              submittedBy: { name: "张三" },
              submittedAt: new Date("2026-04-02T11:00:00.000Z"),
              note: null,
              isLate: false,
            },
            submittedAt: new Date("2026-04-02T11:00:00.000Z"),
            versions: [{ id: "ver-1" }],
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-02T11:00:00.000Z"),
          },
          {
            id: "asg-2",
            taskId: "task-1",
            userId: "user-2",
            user: { name: "李四", email: "lisi@example.com" },
            latestVersionId: null,
            latestVersion: null,
            submittedAt: null,
            versions: [],
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          },
        ],
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        id: "task-1",
        title: "收集任务",
        instruction: "说明",
        dueAt: new Date("2026-04-02T12:00:00.000Z"),
        status: "ACTIVE",
        renameRule: "{姓名}",
        renameVariables: {},
        createdById: "creator-1",
        createdBy: { name: "创建者" },
        attachments: [],
        assignees: [
          {
            id: "asg-1",
            taskId: "task-1",
            userId: "user-1",
            user: { name: "张三", email: "zhangsan@example.com" },
            latestVersionId: "ver-1",
            latestVersion: {
              id: "ver-1",
              assigneeId: "asg-1",
              version: 1,
              fileName: "v1.docx",
              originalFileName: "原件.docx",
              storagePath: "/tmp/v1.docx",
              fileSize: 100,
              mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              submittedById: "user-1",
              submittedBy: { name: "张三" },
              submittedAt: new Date("2026-04-02T11:00:00.000Z"),
              note: null,
              isLate: false,
            },
            submittedAt: new Date("2026-04-02T11:00:00.000Z"),
            versions: [{ id: "ver-1" }],
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-02T11:00:00.000Z"),
          },
        ],
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      })
      .mockResolvedValueOnce(null);

    const service = await import("./document-collection-task.service");

    const creatorResult = await service.getDocumentCollectionTaskDetail({
      taskId: "task-1",
      userId: "creator-1",
      now: new Date("2026-04-02T11:30:00.000Z"),
    });
    expect(creatorResult.success).toBe(true);
    if (creatorResult.success) {
      expect(creatorResult.data.viewerRole).toBe("creator");
      expect(creatorResult.data.assignees).toHaveLength(2);
    }

    const assigneeResult = await service.getDocumentCollectionTaskDetail({
      taskId: "task-1",
      userId: "user-1",
      now: new Date("2026-04-02T11:30:00.000Z"),
    });
    expect(assigneeResult.success).toBe(true);
    if (assigneeResult.success) {
      expect(assigneeResult.data.viewerRole).toBe("assignee");
      expect(assigneeResult.data.assignees).toHaveLength(1);
      expect(assigneeResult.data.assignees[0]?.userId).toBe("user-1");
    }

    const hiddenResult = await service.getDocumentCollectionTaskDetail({
      taskId: "task-1",
      userId: "other-user",
      now: new Date("2026-04-02T11:30:00.000Z"),
    });
    expect(hiddenResult.success).toBe(false);
    if (!hiddenResult.success) {
      expect(hiddenResult.error.code).toBe("NOT_FOUND");
    }
  });

  it("只有创建者可关闭任务，关闭后返回最新详情", async () => {
    dbMock.documentCollectionTask.findFirst
      .mockResolvedValueOnce({
        id: "task-1",
        createdById: "creator-1",
      })
      .mockResolvedValueOnce({
        id: "task-1",
        title: "收集任务",
        instruction: "说明",
        dueAt: new Date("2026-04-02T12:00:00.000Z"),
        status: "CLOSED",
        renameRule: "{姓名}",
        renameVariables: {},
        createdById: "creator-1",
        createdBy: { name: "创建者" },
        attachments: [],
        assignees: [],
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-02T13:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        id: "task-1",
        createdById: "creator-1",
      });
    dbMock.documentCollectionTask.update.mockResolvedValue({
      id: "task-1",
      status: "CLOSED",
    });

    const service = await import("./document-collection-task.service");
    const closeResult = await service.closeDocumentCollectionTask({
      taskId: "task-1",
      userId: "creator-1",
    });
    const deniedResult = await service.closeDocumentCollectionTask({
      taskId: "task-1",
      userId: "other-user",
    });

    expect(closeResult.success).toBe(true);
    if (closeResult.success) {
      expect(closeResult.data.status).toBe("CLOSED");
      expect(closeResult.data.viewerRole).toBe("creator");
    }
    expect(dbMock.documentCollectionTask.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: { status: "CLOSED" },
    });
    expect(deniedResult.success).toBe(false);
    if (!deniedResult.success) {
      expect(deniedResult.error.code).toBe("NOT_FOUND");
    }
  });
});
