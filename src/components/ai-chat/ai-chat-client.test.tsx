import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AIChatClient } from "./ai-chat-client";

const fetchMock = vi.fn();

describe("AIChatClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("历史消息里的待解析附件应刷新状态", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "att-1",
          fileName: "note.txt",
          extractStatus: "completed",
          extractSummary: "历史附件摘要",
        },
      }),
    });

    render(
      <AIChatClient
        conversationId="conv-1"
        initialMessages={[
          {
            id: "msg-1",
            role: "user",
            content: "请看附件",
            attachments: [
              {
                id: "att-1",
                fileName: "note.txt",
                extractStatus: "pending",
              },
            ],
          },
        ]}
      />
    );

    expect(screen.getByText("pending")).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.getByText("completed")).toBeInTheDocument();
        expect(screen.getByText("历史附件摘要")).toBeInTheDocument();
      },
      { timeout: 4000 }
    );
  }, 6000);

  it("收到会话标题事件后应回调更新标题", async () => {
    const onConversationTitleChange = vi.fn();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"type":"conversation-title","conversationId":"conv-1",'
          )
        );
        controller.enqueue(
          new TextEncoder().encode(
            '"title":"附件检查"}\n\ndata: {"type":"message-created","messageId":"msg-a",'
          )
        );
        controller.enqueue(
          new TextEncoder().encode(
            '"role":"assistant"}\n\ndata: {"type":"text-delta","messageId":"msg-a","content":"收到'
          )
        );
        controller.enqueue(
          new TextEncoder().encode(
            '测试附件"}\n\ndata: {"type":"message-completed","messageId":"msg-a"}\n\n'
          )
        );
        controller.close();
      },
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: stream,
    });

    render(
      <AIChatClient
        conversationId="conv-1"
        initialMessages={[]}
        onConversationTitleChange={onConversationTitleChange}
      />
    );

    fireEvent.change(
      screen.getByPlaceholderText("输入消息，Enter 发送，Shift + Enter 换行"),
      {
        target: { value: "请检查附件" },
      }
    );
    fireEvent.keyDown(
      screen.getByPlaceholderText("输入消息，Enter 发送，Shift + Enter 换行"),
      { key: "Enter", shiftKey: false }
    );

    await waitFor(() => {
      expect(onConversationTitleChange).toHaveBeenCalledWith({
        conversationId: "conv-1",
        title: "附件检查",
      });
      expect(screen.getByText("收到测试附件")).toBeInTheDocument();
    });
  });

  it("流式回复时应展示过程时间线", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"type":"message-created","messageId":"msg-a","role":"assistant"}\n\n'
          )
        );
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"type":"tool-call","messageId":"msg-a","toolName":"searchRecords","toolArgs":{}}\n\n'
          )
        );
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"type":"tool-result","messageId":"msg-a","result":{"ok":true}}\n\n'
          )
        );
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"type":"text-delta","messageId":"msg-a","content":"最终答案"}\n\n'
          )
        );
        controller.close();
      },
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: stream,
    });

    render(<AIChatClient conversationId="conv-1" initialMessages={[]} />);

    fireEvent.change(
      screen.getByPlaceholderText("输入消息，Enter 发送，Shift + Enter 换行"),
      {
        target: { value: "帮我查一下" },
      }
    );
    fireEvent.keyDown(
      screen.getByPlaceholderText("输入消息，Enter 发送，Shift + Enter 换行"),
      { key: "Enter", shiftKey: false }
    );

    await waitFor(() => {
      expect(screen.getAllByText("正在生成回复").length).toBeGreaterThan(0);
      expect(screen.getByText("正在查询数据")).toBeInTheDocument();
      expect(screen.getByText("4 个步骤")).toBeInTheDocument();
      expect(screen.getByText("最终答案")).toBeInTheDocument();
    });
  });

  it("流式回复时应支持停止生成", async () => {
    fetchMock.mockImplementationOnce(async (_input, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"message-created","messageId":"msg-stop","role":"assistant"}\n\n'
            )
          );
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"text-delta","messageId":"msg-stop","content":"正在输出"}\n\n'
            )
          );

          signal?.addEventListener("abort", () => {
            controller.error(new DOMException("The operation was aborted.", "AbortError"));
          });
        },
      });

      return {
        ok: true,
        body: stream,
      };
    });

    render(<AIChatClient conversationId="conv-1" initialMessages={[]} />);

    fireEvent.change(
      screen.getByPlaceholderText("输入消息，Enter 发送，Shift + Enter 换行"),
      {
        target: { value: "继续生成" },
      }
    );
    fireEvent.keyDown(
      screen.getByPlaceholderText("输入消息，Enter 发送，Shift + Enter 换行"),
      { key: "Enter", shiftKey: false }
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "停止生成" })).toBeInTheDocument();
      expect(screen.getByText("正在输出")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "停止生成" }));

    await waitFor(() => {
      expect(screen.getByText("已停止")).toBeInTheDocument();
      expect(screen.getAllByText("已停止生成").length).toBeGreaterThan(0);
    });
  });

  it("创建会话失败时应回退到临时聊天接口", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"type":"message-created","messageId":"msg-fallback","role":"assistant"}\n\n'
          )
        );
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"type":"text-delta","messageId":"msg-fallback","content":"回退成功"}\n\n'
          )
        );
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"type":"message-completed","messageId":"msg-fallback"}\n\n'
          )
        );
        controller.close();
      },
    });

    const onCreateConversation = vi.fn().mockResolvedValue(null);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: stream,
    });

    render(
      <AIChatClient
        conversationId={null}
        initialMessages={[]}
        onCreateConversation={onCreateConversation}
      />
    );

    fireEvent.change(
      screen.getByPlaceholderText("输入消息，Enter 发送，Shift + Enter 换行"),
      {
        target: { value: "走回退链路" },
      }
    );
    fireEvent.keyDown(
      screen.getByPlaceholderText("输入消息，Enter 发送，Shift + Enter 换行"),
      { key: "Enter", shiftKey: false }
    );

    await waitFor(() => {
      expect(onCreateConversation).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/ai-agent/chat",
        expect.objectContaining({
          method: "POST",
        })
      );
      expect(screen.getByText("回退成功")).toBeInTheDocument();
    });
  });
});
