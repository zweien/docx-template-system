import { render } from "@testing-library/react"
import type { UIMessage } from "ai"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { MessageParts } from "./message-parts"

vi.mock("./chart-renderer", () => ({
  ChartRenderer: ({ option }: { option: Record<string, unknown> }) => (
    <div data-testid="chart-renderer">{JSON.stringify(option)}</div>
  ),
}))

vi.mock("../ai-chat/assistant-stream-state", () => ({
  AssistantStreamState: () => null,
}))

vi.mock("@/components/ai-elements/message", () => ({
  MessageResponse: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ai-elements/reasoning", () => ({
  Reasoning: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ReasoningTrigger: () => null,
  ReasoningContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ai-elements/sources", () => ({
  Sources: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SourcesTrigger: () => null,
  SourcesContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Source: () => null,
}))

vi.mock("@/components/ai-elements/attachments", () => ({
  Attachments: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Attachment: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AttachmentPreview: () => null,
}))

vi.mock("./tool-confirm-dialog", () => ({
  ToolConfirmDialog: () => null,
}))

describe("MessageParts tool collapsible state", () => {
  it("should not switch a tool from uncontrolled to controlled when confirmation output arrives", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const pendingMessage: UIMessage = {
      id: "msg-tool",
      role: "assistant",
      parts: [
        {
          type: "tool-searchRecords",
          toolCallId: "tool-1",
          state: "input-available",
          input: { query: "论文" },
        },
      ],
    }

    const confirmMessage: UIMessage = {
      id: "msg-tool",
      role: "assistant",
      parts: [
        {
          type: "tool-searchRecords",
          toolCallId: "tool-1",
          state: "output-available",
          input: { query: "论文" },
          output: {
            _needsConfirm: true,
            riskMessage: "需要确认",
            toolInput: { query: "论文" },
            token: "token-1",
          },
        },
      ],
    }

    const { rerender } = render(<MessageParts message={pendingMessage} />)
    rerender(<MessageParts message={confirmMessage} />)

    const hasControlledStateWarning = consoleErrorSpy.mock.calls.some(([message]) =>
      String(message).includes(
        "changing the uncontrolled open state of Collapsible to be controlled"
      )
    )

    expect(hasControlledStateWarning).toBe(false)
    consoleErrorSpy.mockRestore()
  })
})
