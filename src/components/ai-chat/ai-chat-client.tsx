"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { ConfirmAction } from "./confirm-action";
import { useAttachmentStatusPoller } from "./use-attachment-status-poller";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  streamStatus?: string;
  streamTimeline?: string[];
  attachments?: Array<{
    id: string;
    fileName: string;
    mimeType?: string;
    extractStatus?: "pending" | "processing" | "completed" | "failed";
    extractSummary?: string | null;
  }>;
}

interface AttachmentMeta {
  id: string;
  fileName: string;
  mimeType?: string;
  extractStatus?: "pending" | "processing" | "completed" | "failed";
  extractSummary?: string | null;
}

interface PendingConfirm {
  confirmToken: string;
  preview: string;
}

interface AIChatClientProps {
  initialTableId?: string;
  conversationId?: string | null;
  initialMessages?: Message[];
  onCreateConversation?: () => Promise<{ id: string } | null>;
  onConversationTitleChange?: (update: {
    conversationId: string;
    title: string;
  }) => void;
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: "你好！我是 AI 助手，可以通过自然语言查询和编辑数据表。请告诉我你想做什么？",
};

function getToolStatusLabel(toolName?: string) {
  switch (toolName) {
    case "listTables":
      return "正在查看可用数据表";
    case "getTableSchema":
      return "正在读取表结构";
    case "searchRecords":
      return "正在查询数据";
    case "aggregateRecords":
      return "正在汇总统计结果";
    case "createRecord":
    case "updateRecord":
    case "deleteRecord":
      return "正在准备变更操作";
    default:
      return "正在处理工具结果";
  }
}

function appendTimelineStep(message: Message, nextStatus: string) {
  const currentTimeline = message.streamTimeline ?? [];
  if (currentTimeline[currentTimeline.length - 1] === nextStatus) {
    return message;
  }

  return {
    ...message,
    streamStatus: nextStatus,
    streamTimeline: [...currentTimeline, nextStatus],
  };
}

function parseSseEvents(chunk: string, buffer: string) {
  const combined = buffer + chunk;
  const segments = combined.split("\n\n");
  const nextBuffer = segments.pop() ?? "";
  const events = segments
    .map((segment) =>
      segment
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6))
        .join("\n")
    )
    .filter(Boolean);

  return { events, nextBuffer };
}

interface ParsedStreamState {
  assistantMessageId: string | null;
  confirmToken?: string;
  preview?: string;
}

async function resolveConversationTarget(
  conversationId: string | null | undefined,
  onCreateConversation?: () => Promise<{ id: string } | null>
) {
  if (conversationId) {
    return conversationId;
  }

  if (!onCreateConversation) {
    return null;
  }

  try {
    const conversation = await onCreateConversation();
    return conversation?.id ?? null;
  } catch (error) {
    console.error("创建会话失败，回退到临时聊天接口", error);
    return null;
  }
}

export function AIChatClient({
  initialTableId,
  conversationId,
  initialMessages = [],
  onCreateConversation,
  onConversationTitleChange,
}: AIChatClientProps) {
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.length > 0 ? initialMessages : [WELCOME_MESSAGE]
  );
  const [isLoading, setIsLoading] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
      return;
    }

    setMessages([WELCOME_MESSAGE]);
  }, [conversationId, initialMessages]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    []
  );

  const scrollToBottom = () => {
    if (!messageListRef.current) {
      return;
    }

    if (typeof messageListRef.current.scrollTo === "function") {
      messageListRef.current.scrollTo({
        top: messageListRef.current.scrollHeight,
        behavior: "smooth",
      });
      return;
    }

    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const trackedAttachments = useMemo(
    () =>
      messages.flatMap((message) =>
        (message.attachments ?? []).map((attachment) => ({
          ...attachment,
          messageId: message.id,
        }))
      ),
    [messages]
  );
  const refreshedAttachments = useAttachmentStatusPoller(trackedAttachments);

  useEffect(() => {
    if (refreshedAttachments.length === 0) {
      return;
    }

    const attachmentMap = new Map(
      refreshedAttachments.map((attachment) => [attachment.id, attachment])
    );

    setMessages((current) => {
      let hasChanges = false;
      const nextMessages = current.map((message) => {
        if (!message.attachments?.length) {
          return message;
        }

        const nextAttachments = message.attachments.map((attachment) => {
          const refreshedAttachment = attachmentMap.get(attachment.id);
          if (!refreshedAttachment) {
            return attachment;
          }

          return {
            ...attachment,
            extractStatus: refreshedAttachment.extractStatus,
            extractSummary: refreshedAttachment.extractSummary ?? attachment.extractSummary,
          };
        });

        const changed = nextAttachments.some(
          (attachment, index) =>
            attachment.extractStatus !== message.attachments?.[index]?.extractStatus ||
            attachment.extractSummary !== message.attachments?.[index]?.extractSummary
        );

        if (changed) {
          hasChanges = true;
          return { ...message, attachments: nextAttachments };
        }

        return message;
      });

      return hasChanges ? nextMessages : current;
    });
  }, [refreshedAttachments]);

  const handleSend = async (content: string, attachments?: AttachmentMeta[]) => {
    // 添加用户消息
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      attachments,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    streamingMessageIdRef.current = null;

    try {
      const targetConversationId = await resolveConversationTarget(
        conversationId,
        onCreateConversation
      );
      const endpoint = targetConversationId
        ? `/api/ai/conversations/${targetConversationId}/messages`
        : "/api/ai-agent/chat";
      const payload = targetConversationId
        ? {
            message: content,
            tableId: initialTableId,
            attachmentIds: attachments?.map((attachment) => attachment.id),
          }
        : {
            message: content,
            tableId: initialTableId,
            attachmentIds: attachments?.map((attachment) => attachment.id),
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "请求失败");
      }

      // 读取 SSE 流
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      const streamState: ParsedStreamState = {
        assistantMessageId: null,
      };
      let sseBuffer = "";

      const handleStreamEvent = (event: string) => {
        const data = JSON.parse(event);

        if (data.type === "message-created") {
          streamState.assistantMessageId = data.messageId;
          streamingMessageIdRef.current = data.messageId;
          setMessages((prev) => [
            ...prev,
            {
              id: data.messageId,
              role: "assistant",
              content: "",
              isStreaming: true,
              streamStatus: "正在分析问题",
              streamTimeline: ["正在分析问题"],
            },
          ]);
          return;
        }

        if (data.type === "text-delta") {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === data.messageId
                ? {
                    ...appendTimelineStep(message, "正在生成回复"),
                    content: message.content + data.content,
                    isStreaming: true,
                  }
                : message
            )
          );
          return;
        }

        if (data.type === "tool-call") {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === data.messageId
                ? {
                    ...appendTimelineStep(message, getToolStatusLabel(data.toolName)),
                    isStreaming: true,
                  }
                : message
            )
          );
          return;
        }

        if (data.type === "tool-result") {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === data.messageId
                ? {
                    ...appendTimelineStep(message, "正在整理工具结果"),
                    isStreaming: true,
                  }
                : message
            )
          );
          return;
        }

        if (data.type === "confirm-required") {
          streamState.confirmToken = data.confirmToken;
          streamState.preview = data.content;
          streamingMessageIdRef.current = null;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === data.messageId
                ? {
                    ...appendTimelineStep(message, "等待确认执行"),
                    isStreaming: false,
                  }
                : message
            )
          );
          return;
        }

        if (data.type === "conversation-title") {
          onConversationTitleChange?.({
            conversationId: data.conversationId,
            title: data.title,
          });
          return;
        }

        if (data.type === "message-completed") {
          streamingMessageIdRef.current = null;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === data.messageId
                ? {
                    ...message,
                    isStreaming: false,
                    streamStatus:
                      message.streamTimeline?.[message.streamTimeline.length - 1] ??
                      undefined,
                  }
                : message
            )
          );
          return;
        }

        if (data.type === "error") {
          throw new Error(data.content);
        }
      };

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const parsedEvents = parseSseEvents(chunk, sseBuffer);
        sseBuffer = parsedEvents.nextBuffer;

        for (const event of parsedEvents.events) {
          handleStreamEvent(event);
        }
      }

      const finalChunk = decoder.decode();
      if (finalChunk || sseBuffer) {
        const parsedEvents = parseSseEvents(finalChunk, sseBuffer);
        for (const event of parsedEvents.events) {
          handleStreamEvent(event);
        }
      }

      if (!streamState.assistantMessageId) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: "未收到 AI 响应内容",
            isStreaming: false,
          },
        ]);
      }

      // 如果有确认码，显示确认按钮
      if (streamState.confirmToken) {
        setPendingConfirm({
          confirmToken: streamState.confirmToken,
          preview: streamState.preview || "确认执行此操作",
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setMessages((prev) => [
        ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: `错误: ${error instanceof Error ? error.message : "未知错误"}`,
            isStreaming: false,
          },
        ]);
      } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleStopStreaming = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);

    const streamingMessageId = streamingMessageIdRef.current;
    streamingMessageIdRef.current = null;

    if (!streamingMessageId) {
      return;
    }

    setMessages((prev) =>
      prev.map((message) =>
        message.id === streamingMessageId
          ? {
              ...appendTimelineStep(message, "已停止生成"),
              isStreaming: false,
            }
          : message
      )
    );
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
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageList
        messages={messages}
        messagesEndRef={messagesEndRef}
        containerRef={messageListRef}
      />

      {pendingConfirm && (
        <ConfirmAction onConfirm={handleConfirm} isLoading={isConfirming} />
      )}

      <ChatInput
        onSend={handleSend}
        disabled={isLoading}
        isStreaming={isLoading}
        onStop={handleStopStreaming}
      />
    </div>
  );
}
