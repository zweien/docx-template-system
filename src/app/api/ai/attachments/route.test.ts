import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const saveAttachmentMock = vi.fn();
const processAttachmentExtractionMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/ai-attachment.service", () => ({
  saveAttachment: saveAttachmentMock,
  processAttachmentExtraction: processAttachmentExtractionMock,
}));

describe("api/ai/attachments route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未登录时应返回 401", async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import("./route");

    const response = await POST(
      {
        formData: async () => {
          const formData = new FormData();
          formData.set("file", "noop");
          return formData;
        },
      } as never
    );

    expect(response.status).toBe(401);
  });

  it("应保存附件并返回元数据", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    saveAttachmentMock.mockResolvedValue({
      success: true,
      data: {
        id: "att-1",
        fileName: "note.txt",
        mimeType: "text/plain",
        extractStatus: "pending",
      },
    });
    const { POST } = await import("./route");

    const response = await POST(
      {
        formData: async () => ({
          get: (key: string) =>
            key === "file"
              ? {
                  name: "note.txt",
                  type: "text/plain",
                  size: 5,
                  arrayBuffer: async () => new TextEncoder().encode("hello").buffer,
                }
              : null,
        }),
      } as never
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(saveAttachmentMock).toHaveBeenCalled();
    expect(processAttachmentExtractionMock).toHaveBeenCalledWith("att-1");
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("att-1");
  });
});
