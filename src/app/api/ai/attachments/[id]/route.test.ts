import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getAttachmentMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/ai-attachment.service", () => ({
  getAttachment: getAttachmentMock,
}));

describe("api/ai/attachments/[id] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未登录时应返回 401", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost") as never,
      { params: Promise.resolve({ id: "att-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("应返回附件元数据", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getAttachmentMock.mockResolvedValue({
      success: true,
      data: {
        id: "att-1",
        fileName: "note.txt",
        extractStatus: "completed",
      },
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost") as never,
      { params: Promise.resolve({ id: "att-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getAttachmentMock).toHaveBeenCalledWith("att-1");
    expect(body.data.id).toBe("att-1");
  });
});
