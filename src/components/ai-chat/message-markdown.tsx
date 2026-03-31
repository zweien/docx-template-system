"use client";

import { Streamdown } from "streamdown";

interface MessageMarkdownProps {
  content: string;
  isStreaming?: boolean;
}

export function MessageMarkdown({
  content,
  isStreaming = false,
}: MessageMarkdownProps) {
  if (!content && isStreaming) {
    return (
      <div className="space-y-2 py-1">
        <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
        <div className="h-4 w-48 animate-pulse rounded bg-zinc-200" />
        <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
      </div>
    );
  }

  return (
    <div className="streamdown prose prose-sm max-w-none break-words text-current prose-pre:overflow-x-auto prose-code:text-current">
      <Streamdown isAnimating={isStreaming}>{content}</Streamdown>
      {isStreaming && content ? (
        <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-current/45 align-middle" />
      ) : null}
    </div>
  );
}
