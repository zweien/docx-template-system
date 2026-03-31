"use client";

import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square } from "lucide-react";
import { AttachmentPicker } from "./attachment-picker";
import { MessageAttachments } from "./message-attachments";
import { useAttachmentStatusPoller } from "./use-attachment-status-poller";

interface ChatInputProps {
  onSend: (message: string, attachments?: PendingAttachment[]) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  onStop?: () => void;
}

interface PendingAttachment {
  id: string;
  fileName: string;
  mimeType?: string;
  extractStatus?: "pending" | "processing" | "completed" | "failed";
  extractSummary?: string | null;
}

export function ChatInput({
  onSend,
  disabled,
  isStreaming = false,
  onStop,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [draftAttachments, setDraftAttachments] = useState<PendingAttachment[]>([]);
  const attachments = useAttachmentStatusPoller(draftAttachments);

  const handleSend = () => {
    if ((input.trim() || attachments.length > 0) && !disabled) {
      onSend(input.trim(), attachments);
      setInput("");
      setDraftAttachments([]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="shrink-0 border-t p-4">
      {attachments.length > 0 ? (
        <MessageAttachments attachments={attachments} />
      ) : null}
      <div className="mt-3 flex items-end gap-2">
        <AttachmentPicker
          disabled={disabled || isStreaming}
          onUploaded={(attachment) => {
            setDraftAttachments((current) => [...current, attachment]);
          }}
        />
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息，Enter 发送，Shift + Enter 换行"
          disabled={disabled || isStreaming}
          className="max-h-48 min-h-24 flex-1 resize-y"
        />
        {isStreaming ? (
          <Button variant="outline" onClick={onStop} disabled={!onStop}>
            <Square className="h-4 w-4 fill-current" />
            停止生成
          </Button>
        ) : (
          <Button
            onClick={handleSend}
            disabled={disabled || (!input.trim() && attachments.length === 0)}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
