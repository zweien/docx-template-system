"use client";

import { Badge } from "@/components/ui/badge";

interface MessageAttachment {
  id: string;
  fileName: string;
  extractStatus?: "pending" | "processing" | "completed" | "failed";
  extractSummary?: string | null;
}

interface MessageAttachmentsProps {
  attachments: MessageAttachment[];
}

export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="rounded-lg border border-border bg-background/70 px-3 py-2"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-medium">{attachment.fileName}</span>
            <Badge variant="outline">{attachment.extractStatus ?? "pending"}</Badge>
          </div>
          {attachment.extractSummary ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {attachment.extractSummary}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
