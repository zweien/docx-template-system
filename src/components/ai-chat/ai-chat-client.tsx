"use client";

import { useState, useRef, useEffect } from "react";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { ConfirmAction } from "./confirm-action";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface PendingConfirm {
  confirmToken: string;
  preview: string;
}

interface AIChatClientProps {
  initialTableId?: string;
}

export function AIChatClient({ initialTableId }: AIChatClientProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "你好！我是 AI 助手，可以通过自然语言查询和编辑数据表。请告诉我你想做什么？",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (content: string) => {
    // 添加用户消息
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          tableId: initialTableId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "请求失败");
      }

      // 读取 SSE 流
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let confirmToken: string | undefined;
      let preview: string | undefined;

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "text") {
                assistantContent += data.content;
              } else if (data.type === "confirm") {
                confirmToken = data.confirmToken;
                preview = data.content;
              } else if (data.type === "error") {
                throw new Error(data.content);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      // 添加助手消息
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: assistantContent,
        },
      ]);

      // 如果有确认码，显示确认按钮
      if (confirmToken) {
        setPendingConfirm({ confirmToken, preview: preview || "确认执行此操作" });
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `错误: ${error instanceof Error ? error.message : "未知错误"}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!pendingConfirm) return;

    setIsConfirming(true);
    try {
      const response = await fetch("/api/ai-agent/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmToken: pendingConfirm.confirmToken }),
      });

      const result = await response.json();

      if (result.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: "✅ 操作执行成功！",
          },
        ]);
      } else {
        throw new Error(result.error?.message || "执行失败");
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `❌ 执行失败: ${error instanceof Error ? error.message : "未知错误"}`,
        },
      ]);
    } finally {
      setIsConfirming(false);
      setPendingConfirm(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">AI 助手</h2>
        <p className="text-sm text-muted-foreground">通过自然语言查询和编辑数据</p>
      </div>

      <MessageList messages={messages} />

      {pendingConfirm && (
        <ConfirmAction onConfirm={handleConfirm} isLoading={isConfirming} />
      )}

      <ChatInput onSend={handleSend} disabled={isLoading} />

      <div ref={messagesEndRef} />
    </div>
  );
}