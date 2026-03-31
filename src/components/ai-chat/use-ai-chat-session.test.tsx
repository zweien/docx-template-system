import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAIChatSession } from "./use-ai-chat-session";

const fetchMock = vi.fn();

describe("useAIChatSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("应加载初始会话列表", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{ id: "conv-1", title: "最近对话" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "msg-1",
              role: "ASSISTANT",
              content: "# 标题\\n\\n- 项目一",
            },
          ],
        }),
      });

    const { result } = renderHook(() => useAIChatSession({}));

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    expect(result.current.conversations[0]?.title).toBe("最近对话");
    expect(result.current.currentConversationId).toBe("conv-1");
    expect(result.current.messages[0]).toMatchObject({
      id: "msg-1",
      role: "assistant",
      content: "# 标题\\n\\n- 项目一",
    });
  });

  it("应创建新会话并设为当前会话", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: "conv-2", title: "新对话", initialTableId: "table-1" },
        }),
      });

    const { result } = renderHook(() => useAIChatSession({ initialTableId: "table-1" }));

    await act(async () => {
      await result.current.createConversation();
    });

    expect(result.current.currentConversationId).toBe("conv-2");
    expect(result.current.conversations[0]?.id).toBe("conv-2");
  });

  it("切换会话时应加载历史消息", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{ id: "conv-1", title: "最近对话" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "msg-1",
              role: "user",
              content: "你好",
              attachments: [
                {
                  attachment: {
                    id: "att-1",
                    fileName: "note.txt",
                    extractStatus: "completed",
                    extractSummary: "摘要",
                  },
                },
              ],
            },
          ],
        }),
      });

    const { result } = renderHook(() => useAIChatSession({}));

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    await act(async () => {
      await result.current.selectConversation("conv-1");
    });

    expect(result.current.currentConversationId).toBe("conv-1");
    expect(result.current.messages).toEqual([
      {
        id: "msg-1",
        role: "user",
        content: "你好",
        attachments: [
          {
            id: "att-1",
            fileName: "note.txt",
            extractStatus: "completed",
            extractSummary: "摘要",
          },
        ],
      },
    ]);
  });

  it("切换会话时应将历史 assistant 角色归一化为小写，供 Markdown 渲染使用", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{ id: "conv-1", title: "最近对话" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "msg-2",
              role: "ASSISTANT",
              content: "# 标题\\n\\n- 项目一",
            },
          ],
        }),
      });

    const { result } = renderHook(() => useAIChatSession({}));

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    await act(async () => {
      await result.current.selectConversation("conv-1");
    });

    expect(result.current.messages).toEqual([
      {
        id: "msg-2",
        role: "assistant",
        content: "# 标题\\n\\n- 项目一",
        attachments: undefined,
      },
    ]);
  });

  it("应重命名会话并更新本地列表", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{ id: "conv-1", title: "旧标题" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: "conv-1", title: "新标题" },
        }),
      });

    const { result } = renderHook(() => useAIChatSession({}));

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    await act(async () => {
      await result.current.renameConversation("conv-1", "新标题");
    });

    expect(result.current.conversations[0]?.title).toBe("新标题");
  });

  it("应删除当前会话并清空当前选中", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{ id: "conv-1", title: "最近对话" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { count: 1 },
        }),
      });

    const { result } = renderHook(() => useAIChatSession({}));

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    await act(async () => {
      await result.current.deleteConversation("conv-1");
    });

    expect(result.current.conversations).toHaveLength(0);
    expect(result.current.currentConversationId).toBeNull();
  });

  it("应更新会话标题", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [{ id: "conv-1", title: "旧标题" }],
      }),
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [],
      }),
    });

    const { result } = renderHook(() => useAIChatSession({}));

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    act(() => {
      result.current.updateConversationTitle({
        conversationId: "conv-1",
        title: "新标题",
      });
    });

    expect(result.current.conversations[0]?.title).toBe("新标题");
  });

  it("初始会话接口返回空响应体时不应抛错", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      text: async () => "",
    });

    const { result } = renderHook(() => useAIChatSession({}));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.conversations).toHaveLength(0);
    expect(result.current.currentConversationId).toBeNull();
  });
});
