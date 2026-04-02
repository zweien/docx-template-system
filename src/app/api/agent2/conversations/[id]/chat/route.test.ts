import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getConversationMock = vi.fn();
const getSettingsMock = vi.fn();
const getMessagesMock = vi.fn();
const saveMessagesMock = vi.fn();
const resolveModelMock = vi.fn();
const createToolsMock = vi.fn();
const convertToModelMessagesMock = vi.fn();
const streamTextMock = vi.fn();
const stopWhenToken = Symbol("stop-when");
const stepCountIsMock = vi.fn(() => stopWhenToken);

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/agent2-conversation.service", () => ({
  getConversation: getConversationMock,
}));

vi.mock("@/lib/services/agent2-settings.service", () => ({
  getSettings: getSettingsMock,
}));

vi.mock("@/lib/services/agent2-message.service", () => ({
  getMessages: getMessagesMock,
  saveMessages: saveMessagesMock,
}));

vi.mock("@/lib/agent2/model-resolver", () => ({
  resolveModel: resolveModelMock,
}));

vi.mock("@/lib/agent2/tools", () => ({
  createTools: createToolsMock,
}));

vi.mock("ai", () => ({
  convertToModelMessages: convertToModelMessagesMock,
  streamText: streamTextMock,
  stepCountIs: stepCountIsMock,
}));

describe("api/agent2/conversations/[id]/chat route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST 应过滤旧版错误 tool parts，并持久化完整的 assistant UI parts", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getConversationMock.mockResolvedValue({
      success: true,
      data: { id: "conv-1" },
    });
    getSettingsMock.mockResolvedValue({
      success: true,
      data: { autoConfirmTools: {} },
    });
    getMessagesMock.mockResolvedValue({
      success: true,
      data: [
        {
          id: "msg-history-user",
          role: "user",
          parts: [{ type: "text", text: "先帮我看一下销售数据" }],
          createdAt: "2026-04-02T00:00:00.000Z",
        },
        {
          id: "msg-history-assistant",
          role: "assistant",
          parts: [
            { type: "step-start" },
            {
              type: "reasoning",
              text: "我先想一下",
              state: "done",
              providerMetadata: { openai: { itemId: "reason-1" } },
            },
            { type: "text", text: "我先查询一下。" },
            {
              type: "tool-call",
              toolCallId: "legacy-call-1",
              toolName: "searchRecords",
              input: { keyword: "销售" },
            },
            {
              type: "tool-result",
              toolCallId: "legacy-call-1",
              toolName: "searchRecords",
              output: { total: 3 },
            },
          ],
          createdAt: "2026-04-02T00:00:01.000Z",
        },
      ],
    });
    resolveModelMock.mockResolvedValue("mock-model");
    createToolsMock.mockReturnValue({ searchRecords: {} });
    convertToModelMessagesMock.mockResolvedValue([
      { role: "user", content: "先帮我看一下销售数据" },
      { role: "assistant", content: "我先查询一下。" },
      { role: "user", content: "继续，按地区汇总" },
    ]);
    saveMessagesMock.mockResolvedValue({
      success: true,
      data: [],
    });

    streamTextMock.mockImplementation(() => ({
      toUIMessageStreamResponse: ({ originalMessages, onFinish }: { originalMessages: Array<Record<string, unknown>>; onFinish?: (event: { messages: Array<Record<string, unknown>> }) => Promise<void> | void }) => {
        void onFinish?.({
          messages: [
            ...originalMessages,
            {
              id: "msg-assistant-new",
              role: "assistant",
              parts: [
                { type: "text", text: "<think>内部推理</think>\n\n已按地区汇总。" },
                {
                  type: "dynamic-tool",
                  toolCallId: "call-1",
                  toolName: "searchRecords",
                  state: "output-available",
                  input: { groupBy: "region" },
                  output: { rows: [{ region: "华东", total: 12 }] },
                },
              ],
            },
          ],
        });

        return new Response("ok", { status: 200 });
      },
    }));

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/agent2/conversations/conv-1/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "MiniMax-M2.5",
          messages: [
            {
              id: "msg-new-user",
              role: "user",
              parts: [{ type: "text", text: "继续，按地区汇总" }],
            },
          ],
        }),
      }) as never,
      { params: Promise.resolve({ id: "conv-1" }) }
    );

    expect(response.status).toBe(200);
    expect(convertToModelMessagesMock).toHaveBeenCalledWith(
      [
        {
          id: "msg-history-user",
          role: "user",
          parts: [{ type: "text", text: "先帮我看一下销售数据" }],
          createdAt: new Date("2026-04-02T00:00:00.000Z"),
        },
        {
          id: "msg-history-assistant",
          role: "assistant",
          parts: [{ type: "text", text: "我先查询一下。" }],
          createdAt: new Date("2026-04-02T00:00:01.000Z"),
        },
        {
          id: "msg-new-user",
          role: "user",
          parts: [{ type: "text", text: "继续，按地区汇总" }],
        },
      ],
      expect.objectContaining({
        tools: { searchRecords: {} },
        ignoreIncompleteToolCalls: true,
      })
    );
    expect(saveMessagesMock).toHaveBeenCalledWith(
      "conv-1",
      {
        role: "user",
        parts: [{ type: "text", text: "继续，按地区汇总" }],
        attachments: undefined,
      },
      {
        role: "assistant",
        parts: [
          { type: "reasoning", text: "内部推理" },
          { type: "text", text: "已按地区汇总。" },
          {
            type: "dynamic-tool",
            toolCallId: "call-1",
            toolName: "searchRecords",
            state: "output-available",
            input: { groupBy: "region" },
            output: { rows: [{ region: "华东", total: 12 }] },
          },
        ],
      }
    );
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stopWhen: stopWhenToken,
      })
    );
  });
});
