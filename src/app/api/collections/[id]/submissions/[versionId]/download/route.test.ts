import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const downloadDocumentCollectionSubmissionVersionMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/document-collection-download.service", () => ({
  downloadDocumentCollectionSubmissionVersion:
    downloadDocumentCollectionSubmissionVersionMock,
}));

describe("api/collections/[id]/submissions/[versionId]/download route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("有权限时应返回提交版本文件流", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    downloadDocumentCollectionSubmissionVersionMock.mockResolvedValue({
      success: true,
      data: {
        fileName: "材料.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer: Buffer.from("version-file"),
      },
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/collections/task-1/submissions/ver-1/download") as never,
      { params: Promise.resolve({ id: "task-1", versionId: "ver-1" }) }
    );

    expect(response.status).toBe(200);
    expect(downloadDocumentCollectionSubmissionVersionMock).toHaveBeenCalledWith({
      taskId: "task-1",
      versionId: "ver-1",
      userId: "user-1",
    });
    expect(response.headers.get("content-disposition")).toContain(
      "filename*=UTF-8''%E6%9D%90%E6%96%99.docx"
    );
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("version-file");
  });

  it("未登录时应返回 401", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/collections/task-1/submissions/ver-1/download") as never,
      { params: Promise.resolve({ id: "task-1", versionId: "ver-1" }) }
    );

    expect(response.status).toBe(401);
  });
});
