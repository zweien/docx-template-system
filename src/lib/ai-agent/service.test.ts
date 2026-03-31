import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockStreamText, mockChatModel, mockGetTableSchema } = vi.hoisted(() => ({
  mockStreamText: vi.fn(),
  mockChatModel: vi.fn(() => "mock-chat-model"),
  mockGetTableSchema: vi.fn(),
}));

vi.mock("ai", () => ({
  streamText: mockStreamText,
  tool: ({ description, inputSchema, execute }: { description: string; inputSchema: unknown; execute: unknown }) => ({
    description,
    inputSchema,
    execute,
  }),
  stepCountIs: vi.fn(() => "mock-stop-when"),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => ({
    chat: mockChatModel,
  })),
}));

vi.mock("./tools", () => ({
  searchRecords: vi.fn(),
  aggregateRecords: vi.fn(),
  getTableSchema: mockGetTableSchema,
  listTables: vi.fn(),
  getCurrentTime: vi.fn(),
  createRecordPreview: vi.fn(),
  updateRecordPreview: vi.fn(),
  deleteRecordPreview: vi.fn(),
}));

import { chat, createThinkTagStreamSanitizer, sanitizeModelText } from "./service";

beforeEach(() => {
  vi.clearAllMocks();
  mockStreamText.mockReturnValue({
    fullStream: (async function* () {})(),
  });
  mockGetTableSchema.mockResolvedValue({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "数据表不存在",
    },
  });
});

describe("sanitizeModelText", () => {
  it("应移除 think 标签中的内部推理", () => {
    expect(
      sanitizeModelText("<think>内部推理</think>\n\n收到测试消息")
    ).toBe("收到测试消息");
  });

  it("应保留普通回复文本", () => {
    expect(sanitizeModelText("正常回复")).toBe("正常回复");
  });
});

describe("createThinkTagStreamSanitizer", () => {
  it("应在分片流中移除 think 标签内容", () => {
    const sanitizer = createThinkTagStreamSanitizer();

    expect(sanitizer.push("<thi")).toBe("");
    expect(sanitizer.push("nk>内部推理")).toBe("");
    expect(sanitizer.push("</thi")).toBe("");
    expect(sanitizer.push("nk>收到")).toBe("收到");
    expect(sanitizer.push("测试附件")).toBe("测试附件");
    expect(sanitizer.flush()).toBe("");
  });

  it("应保留不含 think 标签的流式文本", () => {
    const sanitizer = createThinkTagStreamSanitizer();

    expect(sanitizer.push("第一段")).toBe("第一段");
    expect(sanitizer.push("第二段")).toBe("第二段");
    expect(sanitizer.flush()).toBe("");
  });
});

describe("chat", () => {
  it("应将历史对话拼接到最终 system prompt", async () => {
    const history = [
      { role: "system" as const, content: "已绑定当前表上下文" },
      { role: "user" as const, content: "今天几号？" },
      { role: "assistant" as const, content: "我先查询当前服务器时间。" },
    ];

    const iterator = chat({
      message: "现在几点？",
      history,
      apiKey: "test-key",
    });

    for await (const _chunk of iterator) {
      // 当前测试只验证调用参数，不需要消费实际流内容
    }

    expect(mockStreamText).toHaveBeenCalledTimes(1);
    const firstCall = mockStreamText.mock.calls[0]?.[0];
    expect(firstCall.system).toContain("## 对话历史");
    expect(firstCall.system).toContain("系统: 已绑定当前表上下文");
    expect(firstCall.system).toContain("用户: 今天几号？");
    expect(firstCall.system).toContain("助手: 我先查询当前服务器时间。");
    expect(firstCall.messages).toEqual([{ role: "user", content: "现在几点？" }]);
    expect(mockChatModel).toHaveBeenCalled();
  });

  it("应同时拼接工具说明、表结构上下文和历史对话", async () => {
    mockGetTableSchema.mockResolvedValue({
      success: true,
      data: {
        id: "table-1",
        name: "客户表",
        fields: [
          { key: "name", label: "姓名", type: "TEXT", required: true },
          { key: "createdAt", label: "创建时间", type: "DATE", required: false },
        ],
      },
    });

    const iterator = chat({
      message: "今天新增了多少客户？",
      tableId: "table-1",
      history: [
        { role: "system" as const, content: "当前正在查看客户表" },
        { role: "user" as const, content: "先看下表结构" },
      ],
      apiKey: "test-key",
    });

    for await (const _chunk of iterator) {
      // 当前测试只验证调用参数，不需要消费实际流内容
    }

    const firstCall = mockStreamText.mock.calls[0]?.[0];
    expect(firstCall.system).toContain("## 可用工具");
    expect(firstCall.system).toContain("getCurrentTime");
    expect(firstCall.system).toContain("## 表: 客户表");
    expect(firstCall.system).toContain("name (姓名): TEXT [必填]");
    expect(firstCall.system).toContain("createdAt (创建时间): DATE");
    expect(firstCall.system).toContain("## 对话历史");
    expect(firstCall.system).toContain("系统: 当前正在查看客户表");
    expect(firstCall.system).toContain("用户: 先看下表结构");
  });
});
