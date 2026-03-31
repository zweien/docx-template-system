import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const renameConversationMock = vi.fn();
const deleteConversationMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/ai-conversation.service", () => ({
  renameConversation: renameConversationMock,
  deleteConversation: deleteConversationMock,
}));

describe("api/ai/conversations/[id] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PATCH 未登录时应返回 401", async () => {
    authMock.mockResolvedValue(null);
    const { PATCH } = await import("./route");

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ title: "新标题" }),
        headers: { "Content-Type": "application/json" },
      }) as never,
      { params: Promise.resolve({ id: "conv-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("PATCH 应重命名会话", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    renameConversationMock.mockResolvedValue({
      success: true,
      data: { id: "conv-1", title: "新标题" },
    });
    const { PATCH } = await import("./route");

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ title: "新标题" }),
        headers: { "Content-Type": "application/json" },
      }) as never,
      { params: Promise.resolve({ id: "conv-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(renameConversationMock).toHaveBeenCalledWith({
      conversationId: "conv-1",
      userId: "user-1",
      title: "新标题",
    });
    expect(body.success).toBe(true);
  });

  it("DELETE 应删除会话", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    deleteConversationMock.mockResolvedValue({
      success: true,
      data: { count: 1 },
    });
    const { DELETE } = await import("./route");

    const response = await DELETE(
      new Request("http://localhost", { method: "DELETE" }) as never,
      { params: Promise.resolve({ id: "conv-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(deleteConversationMock).toHaveBeenCalledWith({
      conversationId: "conv-1",
      userId: "user-1",
    });
    expect(body.success).toBe(true);
  });
});
