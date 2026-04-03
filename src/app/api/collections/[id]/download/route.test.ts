import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const downloadDocumentCollectionTaskArchiveMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/document-collection-download.service", () => ({
  downloadDocumentCollectionTaskArchive: downloadDocumentCollectionTaskArchiveMock,
}));

describe("api/collections/[id]/download route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET 未登录时应返回 401", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/collections/task-1/download") as never,
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("GET 成功时应返回 zip 响应", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    downloadDocumentCollectionTaskArchiveMock.mockResolvedValue({
      success: true,
      data: {
        fileName: "季度资料收集.zip",
        buffer: Buffer.from("zip-content"),
      },
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/collections/task-1/download") as never,
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(response.status).toBe(200);
    expect(downloadDocumentCollectionTaskArchiveMock).toHaveBeenCalledWith({
      taskId: "task-1",
      userId: "user-1",
    });
    expect(response.headers.get("Content-Type")).toBe("application/zip");
  });

  it("GET service 返回 NOT_FOUND 时应返回 404", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    downloadDocumentCollectionTaskArchiveMock.mockResolvedValue({
      success: false,
      error: { code: "NOT_FOUND", message: "任务不存在" },
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/collections/task-1/download") as never,
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(response.status).toBe(404);
  });

  it("GET service 返回 EMPTY_TASK 时应返回 400", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    downloadDocumentCollectionTaskArchiveMock.mockResolvedValue({
      success: false,
      error: { code: "EMPTY_TASK", message: "任务下没有可下载的提交文件" },
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/collections/task-1/download") as never,
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("GET service 返回 DOWNLOAD_FAILED 时应返回 500", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    downloadDocumentCollectionTaskArchiveMock.mockResolvedValue({
      success: false,
      error: { code: "DOWNLOAD_FAILED", message: "打包下载失败" },
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/collections/task-1/download") as never,
      { params: Promise.resolve({ id: "task-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("DOWNLOAD_FAILED");
  });
});
