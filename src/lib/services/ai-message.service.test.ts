import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = {
  aiMessage: {
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  aiConversation: {
    update: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

describe("ai-message.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createUserMessage 应创建用户消息并刷新会话时间", async () => {
    dbMock.aiMessage.create.mockResolvedValue({
      id: "msg-user-1",
      role: "USER",
      content: "查询一下合同",
      status: "COMPLETED",
    });

    const service = await import("./ai-message.service");
    const result = await service.createUserMessage({
      conversationId: "conv-1",
      content: "查询一下合同",
      attachmentIds: ["att-1"],
    });

    expect(result.success).toBe(true);
    expect(dbMock.aiMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: "conv-1",
        role: "USER",
        status: "COMPLETED",
        content: "查询一下合同",
      }),
      include: {
        attachments: true,
      },
    });
    expect(dbMock.aiConversation.update).toHaveBeenCalled();
  });

  it("createAssistantPlaceholder 应创建 streaming 状态消息", async () => {
    dbMock.aiMessage.create.mockResolvedValue({
      id: "msg-assistant-1",
      role: "ASSISTANT",
      status: "STREAMING",
      content: "",
    });

    const service = await import("./ai-message.service");
    const result = await service.createAssistantPlaceholder("conv-1");

    expect(result.success).toBe(true);
    expect(dbMock.aiMessage.create).toHaveBeenCalledWith({
      data: {
        conversationId: "conv-1",
        role: "ASSISTANT",
        status: "STREAMING",
        content: "",
      },
      include: {
        attachments: true,
      },
    });
  });

  it("completeAssistantMessage 应回写内容与完成状态", async () => {
    dbMock.aiMessage.update.mockResolvedValue({
      id: "msg-assistant-1",
      status: "COMPLETED",
      content: "这里是最终答复",
    });

    const service = await import("./ai-message.service");
    const result = await service.completeAssistantMessage({
      messageId: "msg-assistant-1",
      content: "这里是最终答复",
    });

    expect(result.success).toBe(true);
    expect(dbMock.aiMessage.update).toHaveBeenCalledWith({
      where: { id: "msg-assistant-1" },
      data: {
        status: "COMPLETED",
        content: "这里是最终答复",
        errorMessage: null,
      },
      include: {
        attachments: true,
      },
    });
  });

  it("failAssistantMessage 应记录失败原因", async () => {
    dbMock.aiMessage.update.mockResolvedValue({
      id: "msg-assistant-1",
      status: "FAILED",
      errorMessage: "模型超时",
    });

    const service = await import("./ai-message.service");
    const result = await service.failAssistantMessage({
      messageId: "msg-assistant-1",
      errorMessage: "模型超时",
    });

    expect(result.success).toBe(true);
    expect(dbMock.aiMessage.update).toHaveBeenCalledWith({
      where: { id: "msg-assistant-1" },
      data: {
        status: "FAILED",
        errorMessage: "模型超时",
      },
      include: {
        attachments: true,
      },
    });
  });

  it("listMessagesByConversation 应返回带附件的历史消息", async () => {
    dbMock.aiMessage.findMany.mockResolvedValue([
      {
        id: "msg-1",
        role: "user",
        content: "你好",
        attachments: [{ attachment: { id: "att-1", fileName: "a.txt" } }],
      },
    ]);

    const service = await import("./ai-message.service");
    const result = await service.listMessagesByConversation("conv-1");

    expect(result.success).toBe(true);
    expect(dbMock.aiMessage.findMany).toHaveBeenCalledWith({
      where: { conversationId: "conv-1" },
      orderBy: { createdAt: "asc" },
      include: {
        attachments: {
          include: {
            attachment: true,
          },
        },
      },
    });
  });
});
