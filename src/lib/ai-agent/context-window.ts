interface ContextMessage {
  id: string;
  role: string;
  content: string;
}

interface ContextAttachment {
  id: string;
  fileName: string;
  extractSummary?: string | null;
}

interface BuildConversationContextInput {
  history: ContextMessage[];
  attachments: ContextAttachment[];
  limit?: number;
}

export function selectRecentMessages<T>(messages: T[], limit: number) {
  if (limit <= 0) {
    return [];
  }

  return messages.slice(-limit);
}

export function summarizeAttachmentContext(
  attachments: ContextAttachment[],
  summaryLimit = 180
) {
  return attachments
    .filter((attachment) => attachment.extractSummary)
    .map((attachment) => {
      const summary = attachment.extractSummary!.slice(0, summaryLimit);
      return `附件 ${attachment.fileName}: ${summary}`;
    })
    .join("\n");
}

export function buildConversationContext(
  input: BuildConversationContextInput
) {
  const history = selectRecentMessages(input.history, input.limit ?? 8)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
  const attachmentSummary = summarizeAttachmentContext(input.attachments);

  return [history, attachmentSummary].filter(Boolean).join("\n\n");
}
