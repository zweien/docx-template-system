import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getDocumentCollectionTaskDetailMock = vi.fn();
const closeDocumentCollectionTaskMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/document-collection-task.service", () => ({
  getDocumentCollectionTaskDetail: getDocumentCollectionTaskDetailMock,
  closeDocumentCollectionTask: closeDocumentCollectionTaskMock,
}));

describe("api/collections/[id] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET 未登录时应返回 401", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/collections/task-1") as never,
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("GET 应将 service 的 NOT_FOUND 映射为 404", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getDocumentCollectionTaskDetailMock.mockResolvedValue({
      success: false,
      error: { code: "NOT_FOUND", message: "任务不存在" },
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/collections/task-1") as never,
      { params: Promise.resolve({ id: "task-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(getDocumentCollectionTaskDetailMock).toHaveBeenCalledWith({
      taskId: "task-1",
      userId: "user-1",
    });
    expect(body.error.message).toBe("任务不存在");
  });

  it("GET 非 NOT_FOUND 的 service failure 应返回 500", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getDocumentCollectionTaskDetailMock.mockResolvedValue({
      success: false,
      error: { code: "GET_FAILED", message: "获取任务详情失败" },
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/collections/task-1") as never,
      { params: Promise.resolve({ id: "task-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("GET_FAILED");
  });

  it("PATCH 应关闭任务并返回最新详情", async () => {
    authMock.mockResolvedValue({ user: { id: "creator-1" } });
    closeDocumentCollectionTaskMock.mockResolvedValue({
      success: true,
      data: {
        id: "task-1",
        status: "CLOSED",
        viewerRole: "creator",
      },
    });
    const { PATCH } = await import("./route");

    const response = await PATCH(
      new Request("http://localhost/api/collections/task-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "close" }),
      }) as never,
      { params: Promise.resolve({ id: "task-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(closeDocumentCollectionTaskMock).toHaveBeenCalledWith({
      taskId: "task-1",
      userId: "creator-1",
    });
    expect(body.data.status).toBe("CLOSED");
  });
});
