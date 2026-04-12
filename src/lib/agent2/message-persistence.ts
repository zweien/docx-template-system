import type { UIMessage } from "ai"
import { parseThinkTaggedText } from "@/lib/agent2/think-parser"

type PersistableMessage = {
  role: "user" | "assistant"
  parts: UIMessage["parts"]
  attachments?: unknown
}

function isReplayablePartType(type: string): boolean {
  return (
    type === "text" ||
    type === "file" ||
    type === "dynamic-tool" ||
    (
      type.startsWith("tool-") &&
      type !== "tool-call" &&
      type !== "tool-result" &&
      type !== "tool-approval-request" &&
      type !== "tool-approval-response"
    ) ||
    type.startsWith("data-")
  )
}

function sanitizePart(part: UIMessage["parts"][number]) {
  if (part.type === "text") {
    return {
      type: "text" as const,
      text: part.text,
    }
  }

  if (part.type === "reasoning") {
    return {
      type: "reasoning" as const,
      text: part.text,
      ...(part.state ? { state: part.state } : {}),
    }
  }

  if (part.type === "file") {
    return {
      type: "file" as const,
      mediaType: part.mediaType,
      filename: part.filename,
      url: part.url,
    }
  }

  if (part.type === "dynamic-tool") {
    const base = {
      type: "dynamic-tool" as const,
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      state: part.state,
    }

    switch (part.state) {
      case "input-available":
        return {
          ...base,
          input: part.input,
        }
      case "output-available":
        return {
          ...base,
          input: part.input,
          output: part.output,
        }
      case "output-error":
        return {
          ...base,
          input: part.input,
          errorText: part.errorText,
        }
      case "output-denied":
        return {
          ...base,
          input: part.input,
        }
      case "approval-responded":
        return {
          ...base,
          input: part.input,
          output: "output" in part ? part.output : undefined,
        }
      default:
        return {
          ...base,
          input: "input" in part ? part.input : undefined,
        }
    }
  }

  if (part.type.startsWith("tool-")) {
    return {
      ...part,
    }
  }

  return null
}

export function sanitizeStoredMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts
      .filter((part) => isReplayablePartType(part.type))
      .map((part) => sanitizePart(part))
      .filter((part) => part != null),
  })) as UIMessage[]
}

export function getLatestPersistableMessages(
  messages: UIMessage[]
): {
  userMessage: PersistableMessage
  assistantMessage: PersistableMessage
} | null {
  const assistantIndex = [...messages]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find(({ message }) => message.role === "assistant")?.index

  if (assistantIndex == null) {
    return null
  }

  const userMessage = [...messages.slice(0, assistantIndex)]
    .reverse()
    .find((message) => message.role === "user")
  const assistantMessage = messages[assistantIndex]

  if (!userMessage || assistantMessage.role !== "assistant") {
    return null
  }

  return {
    userMessage: {
      id: userMessage.id,
      role: "user",
      parts: userMessage.parts,
      attachments: "experimental_attachments" in userMessage
        ? userMessage.experimental_attachments
        : undefined,
    },
    assistantMessage: {
      id: assistantMessage.id,
      role: "assistant",
      parts: assistantMessage.parts.flatMap((part): UIMessage['parts'] => {
        if (part.type !== "text") {
          return [part]
        }

        const segments = parseThinkTaggedText(part.text)
        if (segments.length === 0) {
          return []
        }

        return segments.map((segment) =>
          segment.type === "reasoning"
            ? { type: "reasoning" as const, text: segment.text }
            : { ...part, text: segment.text }
        )
      }),
    },
  }
}
