"use client";

import type { RefObject } from "react";
import { AssistantStreamState } from "./assistant-stream-state";
import { MessageMarkdown } from "./message-markdown";
import { MessageAttachments } from "./message-attachments";

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
    extractStatus?: "pending" | "processing" | "completed" | "failed";
    extractSummary?: string | null;
  }>;
}

interface MessageListProps {
  messages: Message[];
  messagesEndRef?: RefObject<HTMLDivElement | null>;
  containerRef?: RefObject<HTMLDivElement | null>;
}

export function MessageList({
  messages,
  messagesEndRef,
  containerRef,
}: MessageListProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto" ref={containerRef}>
      <div className="space-y-4 p-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === "user"
                  ? "bg-blue-100 text-blue-900"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              {msg.role === "assistant" ? (
                <>
                  <AssistantStreamState
                    status={msg.streamStatus}
                    timeline={msg.streamTimeline}
                    isStreaming={msg.isStreaming}
                    hasContent={Boolean(msg.content)}
                  />
                  <MessageMarkdown
                    content={msg.content}
                    isStreaming={msg.isStreaming}
                  />
                </>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
              {msg.attachments?.length ? (
                <MessageAttachments attachments={msg.attachments} />
              ) : null}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
