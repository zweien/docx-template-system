import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const listDocumentCollectionTasksMock = vi.fn();
const createDocumentCollectionTaskMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/document-collection-task.service", () => ({
  listDocumentCollectionTasks: listDocumentCollectionTasksMock,
  createDocumentCollectionTask: createDocumentCollectionTaskMock,
}));

describe("api/collections route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET 未登录时应返回 401", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/collections") as never
    );

    expect(response.status).toBe(401);
  });

  it("GET 应解析 query 并调用 listDocumentCollectionTasks", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    listDocumentCollectionTasksMock.mockResolvedValue({
      success: true,
      data: [{ id: "task-1", title: "任务一" }],
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request(
        "http://localhost/api/collections?scope=assigned&status=active&search=合同"
      ) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listDocumentCollectionTasksMock).toHaveBeenCalledWith({
      userId: "user-1",
      scope: "assigned",
      status: "active",
      search: "合同",
    });
    expect(body.success).toBe(true);
  });

  it("GET query 校验失败时应返回 400", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/collections?scope=invalid") as never
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(listDocumentCollectionTasksMock).not.toHaveBeenCalled();
    expect(body.error.message).toBe("参数校验失败");
  });

  it("GET service failed 时应返回 500", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    listDocumentCollectionTasksMock.mockResolvedValue({
      success: false,
      error: { code: "LIST_FAILED", message: "获取任务列表失败" },
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/collections") as never
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("LIST_FAILED");
  });

  it("POST 未登录时应返回 401", async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import("./route");

    const formData = new FormData();
    formData.set("title", "季度资料收集");

    const response = await POST({
      formData: async () => formData,
    } as never);

    expect(response.status).toBe(401);
  });

  it("POST 应创建任务并返回 201", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createDocumentCollectionTaskMock.mockResolvedValue({
      success: true,
      data: { id: "task-1", title: "季度资料收集" },
    });
    const { POST } = await import("./route");

    const formData = new FormData();
    formData.set("title", "季度资料收集");
    formData.set("instruction", "请上传盖章文件");
    formData.set("dueAt", "2026-04-10T10:00:00.000Z");
    formData.append("assigneeIds", "user-2");
    formData.append("assigneeIds", "user-3");
    formData.set("renameRule", "{姓名}_{原始文件名}");
    formData.set(
      "renameVariables",
      JSON.stringify({
        部门: "法务部",
      })
    );
    formData.append(
      "attachments",
      new Blob(["hello"], { type: "application/pdf" }),
      "说明.pdf"
    );

    const response = await POST({
      formData: async () => formData,
    } as never);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(createDocumentCollectionTaskMock).toHaveBeenCalledTimes(1);
    const input = createDocumentCollectionTaskMock.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      creatorId: "user-1",
      title: "季度资料收集",
      instruction: "请上传盖章文件",
      dueAt: new Date("2026-04-10T10:00:00.000Z"),
      assigneeIds: ["user-2", "user-3"],
      renameRule: "{姓名}_{原始文件名}",
      renameVariables: {
        部门: "法务部",
      },
    });
    expect(input.attachments).toHaveLength(1);
    expect(input.attachments[0].id).toEqual(expect.any(String));
    expect(input.attachments[0].originalFileName).toBe("说明.pdf");
    expect(input.attachments[0].mimeType).toBe("application/pdf");
    expect(input.attachments[0].fileSize).toBe(5);
    expect(Buffer.from(input.attachments[0].buffer).toString()).toBe("hello");
    expect(body.success).toBe(true);
  });

  it("POST renameVariables 非法 JSON 时应返回 400", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const { POST } = await import("./route");

    const formData = new FormData();
    formData.set("title", "季度资料收集");
    formData.set("instruction", "请上传盖章文件");
    formData.set("dueAt", "2026-04-10T10:00:00.000Z");
    formData.append("assigneeIds", "user-2");
    formData.set("renameRule", "{姓名}_{原始文件名}");
    formData.set("renameVariables", "{not-json}");

    const response = await POST(
      new Request("http://localhost/api/collections", {
        method: "POST",
        body: formData,
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(createDocumentCollectionTaskMock).not.toHaveBeenCalled();
    expect(body.error.message).toBe("renameVariables 必须是合法 JSON");
  });
});
