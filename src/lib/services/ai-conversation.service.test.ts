import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = {
  aiConversation: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

describe("ai-conversation.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createConversation 应创建带初始 tableId 的会话", async () => {
    dbMock.aiConversation.create.mockResolvedValue({
      id: "conv-1",
      title: "新对话",
      userId: "user-1",
      initialTableId: "table-1",
      runtime: "AI_SDK",
      lastMessageAt: new Date("2026-03-30T00:00:00.000Z"),
      createdAt: new Date("2026-03-30T00:00:00.000Z"),
      updatedAt: new Date("2026-03-30T00:00:00.000Z"),
    });

    const service = await import("./ai-conversation.service");
    const result = await service.createConversation({
      userId: "user-1",
      initialTableId: "table-1",
    });

    expect(result.success).toBe(true);
    expect(dbMock.aiConversation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        initialTableId: "table-1",
        runtime: "AI_SDK",
      }),
    });
  });

  it("listConversationsByUser 应按最后消息时间倒序返回", async () => {
    dbMock.aiConversation.findMany.mockResolvedValue([
      { id: "conv-2", title: "较新", lastMessageAt: new Date("2026-03-30T02:00:00.000Z") },
      { id: "conv-1", title: "较旧", lastMessageAt: new Date("2026-03-30T01:00:00.000Z") },
    ]);

    const service = await import("./ai-conversation.service");
    const result = await service.listConversationsByUser("user-1");

    expect(result.success).toBe(true);
    expect(dbMock.aiConversation.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { lastMessageAt: "desc" },
    });
    if (!result.success) {
      return;
    }
    expect(result.data[0]?.id).toBe("conv-2");
  });

  it("renameConversation 应仅更新当前用户拥有的会话", async () => {
    dbMock.aiConversation.findFirst.mockResolvedValue({
      id: "conv-1",
      userId: "user-1",
    });
    dbMock.aiConversation.update.mockResolvedValue({
      id: "conv-1",
      title: "新标题",
    });

    const service = await import("./ai-conversation.service");
    const result = await service.renameConversation({
      conversationId: "conv-1",
      userId: "user-1",
      title: "新标题",
    });

    expect(result.success).toBe(true);
    expect(dbMock.aiConversation.update).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { title: "新标题" },
    });
  });

  it("deleteConversation 应拒绝删除他人的会话", async () => {
    dbMock.aiConversation.findFirst.mockResolvedValue(null);

    const service = await import("./ai-conversation.service");
    const result = await service.deleteConversation({
      conversationId: "conv-1",
      userId: "user-1",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.code).toBe("NOT_FOUND");
  });
});
