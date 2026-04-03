import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const downloadDocumentCollectionAttachmentMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/document-collection-download.service", () => ({
  downloadDocumentCollectionAttachment: downloadDocumentCollectionAttachmentMock,
}));

describe("api/collections/[id]/attachments/[attachmentId]/download route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未登录时应返回 401", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/collections/task-1/attachments/att-1/download") as never,
      { params: Promise.resolve({ id: "task-1", attachmentId: "att-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("有权限时应返回附件文件流", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    downloadDocumentCollectionAttachmentMock.mockResolvedValue({
      success: true,
      data: {
        fileName: "说明.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("attachment"),
      },
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/collections/task-1/attachments/att-1/download") as never,
      { params: Promise.resolve({ id: "task-1", attachmentId: "att-1" }) }
    );

    expect(response.status).toBe(200);
    expect(downloadDocumentCollectionAttachmentMock).toHaveBeenCalledWith({
      taskId: "task-1",
      attachmentId: "att-1",
      userId: "user-1",
    });
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(
      "filename*=UTF-8''%E8%AF%B4%E6%98%8E.pdf"
    );
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("attachment");
  });

  it("无权限或不存在时应返回 404", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    downloadDocumentCollectionAttachmentMock.mockResolvedValue({
      success: false,
      error: { code: "NOT_FOUND", message: "任务不存在" },
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/collections/task-1/attachments/att-1/download") as never,
      { params: Promise.resolve({ id: "task-1", attachmentId: "att-1" }) }
    );

    expect(response.status).toBe(404);
  });
});
