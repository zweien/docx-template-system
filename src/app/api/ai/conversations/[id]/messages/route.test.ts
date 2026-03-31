import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const listMessagesByConversationMock = vi.fn();
const createUserMessageMock = vi.fn();
const createAssistantPlaceholderMock = vi.fn();
const completeAssistantMessageMock = vi.fn();
const failAssistantMessageMock = vi.fn();
const updateConversationTitleIfDefaultMock = vi.fn();
const listAttachmentsByIdsMock = vi.fn();
const chatMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/ai-message.service", () => ({
  listMessagesByConversation: listMessagesByConversationMock,
  createUserMessage: createUserMessageMock,
  createAssistantPlaceholder: createAssistantPlaceholderMock,
  completeAssistantMessage: completeAssistantMessageMock,
  failAssistantMessage: failAssistantMessageMock,
}));

vi.mock("@/lib/services/ai-conversation.service", () => ({
  updateConversationTitleIfDefault: updateConversationTitleIfDefaultMock,
  deriveConversationTitleFromMessage: (message: string) => message,
}));

vi.mock("@/lib/services/ai-attachment.service", () => ({
  listAttachmentsByIds: listAttachmentsByIdsMock,
}));

vi.mock("@/lib/ai-agent/service", () => ({
  chat: chatMock,
}));

describe("api/ai/conversations/[id]/messages route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET 未登录时应返回 401", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost") as never,
      { params: Promise.resolve({ id: "conv-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("GET 应返回会话历史", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    listMessagesByConversationMock.mockResolvedValue({
      success: true,
      data: [{ id: "msg-1", role: "user", content: "你好" }],
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost") as never,
      { params: Promise.resolve({ id: "conv-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listMessagesByConversationMock).toHaveBeenCalledWith("conv-1");
    expect(body.data).toHaveLength(1);
  });

  it("POST 应先持久化用户消息，再输出 SSE", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createUserMessageMock.mockResolvedValue({
      success: true,
      data: { id: "msg-user-1" },
    });
    createAssistantPlaceholderMock.mockResolvedValue({
      success: true,
      data: { id: "msg-assistant-1" },
    });
    listAttachmentsByIdsMock.mockResolvedValue({
      success: true,
      data: [],
    });
    updateConversationTitleIfDefaultMock.mockResolvedValue({
      success: true,
      data: { title: "打个招呼", updated: true },
    });
    completeAssistantMessageMock.mockResolvedValue({
      success: true,
      data: { id: "msg-assistant-1" },
    });
    chatMock.mockImplementation(async function* () {
      yield { type: "tool_call", toolName: "listTables", toolArgs: {} };
      yield { type: "result", result: { ok: true } };
      yield { type: "text", content: "你好" };
      yield { type: "text", content: "，世界" };
    });

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ message: "打个招呼" }),
        headers: {
          "Content-Type": "application/json",
        },
      }) as never,
      { params: Promise.resolve({ id: "conv-1" }) }
    );

    expect(response.status).toBe(200);
    expect(createUserMessageMock).toHaveBeenCalledWith({
      conversationId: "conv-1",
      content: "打个招呼",
      attachmentIds: undefined,
    });
    expect(createAssistantPlaceholderMock).toHaveBeenCalledWith("conv-1");
    expect(updateConversationTitleIfDefaultMock).toHaveBeenCalledWith({
      conversationId: "conv-1",
      userId: "user-1",
      title: "打个招呼",
    });

    const text = await response.text();
    expect(text).toContain('"type":"message-created"');
    expect(text).toContain('"type":"conversation-title"');
    expect(text).toContain('"type":"tool-call"');
    expect(text).toContain('"type":"tool-result"');
    expect(text).toContain('"type":"text-delta"');
    expect(text).toContain('"type":"message-completed"');
    expect(completeAssistantMessageMock).toHaveBeenCalledWith({
      messageId: "msg-assistant-1",
      content: "你好，世界",
    });
  });

  it("POST 运行失败时应标记 assistant 消息失败", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createUserMessageMock.mockResolvedValue({
      success: true,
      data: { id: "msg-user-1" },
    });
    createAssistantPlaceholderMock.mockResolvedValue({
      success: true,
      data: { id: "msg-assistant-1" },
    });
    listAttachmentsByIdsMock.mockResolvedValue({
      success: true,
      data: [],
    });
    updateConversationTitleIfDefaultMock.mockResolvedValue({
      success: true,
      data: { title: "失败一下", updated: true },
    });
    failAssistantMessageMock.mockResolvedValue({
      success: true,
      data: { id: "msg-assistant-1" },
    });
    chatMock.mockImplementation(async function* () {
      throw new Error("模型超时");
    });

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ message: "失败一下" }),
        headers: {
          "Content-Type": "application/json",
        },
      }) as never,
      { params: Promise.resolve({ id: "conv-1" }) }
    );

    const text = await response.text();
    expect(text).toContain('"type":"error"');
    expect(failAssistantMessageMock).toHaveBeenCalledWith({
      messageId: "msg-assistant-1",
      errorMessage: "模型超时",
    });
  });

  it("POST 应将已完成附件摘要注入模型输入", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createUserMessageMock.mockResolvedValue({
      success: true,
      data: { id: "msg-user-1" },
    });
    createAssistantPlaceholderMock.mockResolvedValue({
      success: true,
      data: { id: "msg-assistant-1" },
    });
    updateConversationTitleIfDefaultMock.mockResolvedValue({
      success: true,
      data: { title: "检查附件", updated: true },
    });
    listAttachmentsByIdsMock.mockResolvedValue({
      success: true,
      data: [
        {
          id: "att-1",
          fileName: "brief.txt",
          extractStatus: "completed",
          extractSummary: "这是一份测试附件摘要",
        },
      ],
    });
    completeAssistantMessageMock.mockResolvedValue({
      success: true,
      data: { id: "msg-assistant-1" },
    });
    chatMock.mockImplementation(async function* () {
      yield { type: "text", content: "收到测试附件" };
    });

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          message: "请检查附件",
          attachmentIds: ["att-1"],
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }) as never,
      { params: Promise.resolve({ id: "conv-1" }) }
    );

    expect(response.status).toBe(200);
    expect(listAttachmentsByIdsMock).toHaveBeenCalledWith(["att-1"]);
    expect(chatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("## 当前消息附件摘要"),
      })
    );
    expect(chatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("附件 brief.txt: 这是一份测试附件摘要"),
      })
    );
  });
});
