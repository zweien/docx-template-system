type MessageCreatedEvent = {
  type: "message-created";
  messageId: string;
  role: "assistant" | "user" | "system";
};

type TextDeltaEvent = {
  type: "text-delta";
  messageId: string;
  content: string;
};

type MessageCompletedEvent = {
  type: "message-completed";
  messageId: string;
};

type ConfirmRequiredEvent = {
  type: "confirm-required";
  messageId: string;
  confirmToken: string;
  content: string;
};

type ErrorEvent = {
  type: "error";
  messageId?: string;
  content: string;
};

type ToolCallEvent = {
  type: "tool-call";
  messageId: string;
  toolName: string;
  toolArgs?: unknown;
};

type ToolResultEvent = {
  type: "tool-result";
  messageId: string;
  result: unknown;
};

type AttachmentStatusEvent = {
  type: "attachment-status";
  attachmentId: string;
  status: "pending" | "processing" | "completed" | "failed";
  content?: string;
};

type ConversationCreatedEvent = {
  type: "conversation-created";
  conversationId: string;
};

type ConversationTitleUpdatedEvent = {
  type: "conversation-title";
  conversationId: string;
  title: string;
};

export type AIStreamEvent =
  | AttachmentStatusEvent
  | ConfirmRequiredEvent
  | ConversationCreatedEvent
  | ConversationTitleUpdatedEvent
  | ErrorEvent
  | MessageCompletedEvent
  | MessageCreatedEvent
  | TextDeltaEvent
  | ToolCallEvent
  | ToolResultEvent;

const VALID_EVENT_TYPES = new Set<AIStreamEvent["type"]>([
  "attachment-status",
  "confirm-required",
  "conversation-created",
  "conversation-title",
  "error",
  "message-completed",
  "message-created",
  "text-delta",
  "tool-call",
  "tool-result",
]);

export function isStreamEvent(value: unknown): value is AIStreamEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const event = value as { type?: unknown };
  return typeof event.type === "string" && VALID_EVENT_TYPES.has(event.type as AIStreamEvent["type"]);
}

export function encodeStreamEvent(event: AIStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function parseStreamEvent(line: string): AIStreamEvent {
  if (!line.startsWith("data: ")) {
    throw new Error("无效的流式事件");
  }

  const parsed = JSON.parse(line.slice(6)) as unknown;
  if (!isStreamEvent(parsed)) {
    throw new Error("无效的流式事件");
  }

  return parsed;
}
