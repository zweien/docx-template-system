import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const listConversationsByUserMock = vi.fn();
const createConversationMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/ai-conversation.service", () => ({
  listConversationsByUser: listConversationsByUserMock,
  createConversation: createConversationMock,
}));

describe("api/ai/conversations route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET 未登录时应返回 401", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("GET 应返回当前用户会话列表", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    listConversationsByUserMock.mockResolvedValue({
      success: true,
      data: [{ id: "conv-1", title: "对话一" }],
    });
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listConversationsByUserMock).toHaveBeenCalledWith("user-1");
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it("POST 应创建会话", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createConversationMock.mockResolvedValue({
      success: true,
      data: { id: "conv-1", title: "新对话" },
    });
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/ai/conversations", {
        method: "POST",
        body: JSON.stringify({ initialTableId: "table-1" }),
        headers: {
          "Content-Type": "application/json",
        },
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(createConversationMock).toHaveBeenCalledWith({
      userId: "user-1",
      initialTableId: "table-1",
      title: undefined,
    });
    expect(body.success).toBe(true);
  });

  it("POST 服务异常时应返回 500", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createConversationMock.mockRejectedValue(new Error("delegate unavailable"));
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/ai/conversations", {
        method: "POST",
        body: JSON.stringify({ initialTableId: "table-1" }),
        headers: {
          "Content-Type": "application/json",
        },
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
