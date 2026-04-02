import { render, screen } from "@testing-library/react"
import type { UIMessage } from "ai"
import { describe, expect, it, vi } from "vitest"
import { MessageParts } from "./message-parts"

const { chartRendererMock, assistantStreamStateMock } = vi.hoisted(() => ({
  chartRendererMock: vi.fn(
    ({ option }: { option: Record<string, unknown> }) => (
      <div data-testid="chart-renderer">{JSON.stringify(option)}</div>
    )
  ),
  assistantStreamStateMock: vi.fn(
    ({
      status,
      timeline,
      isStreaming,
      hasContent,
    }: {
      status?: string
      timeline?: string[]
      isStreaming?: boolean
      hasContent?: boolean
    }) => (
      <div
        data-testid="assistant-stream-state"
        data-status={status}
        data-streaming={String(isStreaming)}
        data-has-content={String(hasContent)}
      >
        {(timeline ?? []).join("|")}
      </div>
    )
  ),
}))

vi.mock("./chart-renderer", () => ({
  ChartRenderer: chartRendererMock,
}))

vi.mock("../ai-chat/assistant-stream-state", () => ({
  AssistantStreamState: assistantStreamStateMock,
}))

vi.mock("@/components/ai-elements/message", () => ({
  MessageResponse: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ai-elements/reasoning", () => ({
  Reasoning: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ReasoningTrigger: () => null,
  ReasoningContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ai-elements/tool", () => ({
  Tool: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ToolHeader: () => null,
  ToolContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ToolInput: () => null,
  ToolOutput: ({ output }: { output: unknown }) => <div data-testid="tool-output">{JSON.stringify(output)}</div>,
}))

vi.mock("@/components/ai-elements/sources", () => ({
  Sources: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SourcesTrigger: () => null,
  SourcesContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Source: () => null,
}))

vi.mock("@/components/ai-elements/attachments", () => ({
  Attachments: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Attachment: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AttachmentPreview: () => null,
}))

vi.mock("./tool-confirm-dialog", () => ({
  ToolConfirmDialog: () => null,
}))

describe("MessageParts", () => {
  it("应根据消息 parts 展示回答过程时间线", () => {
    const message: UIMessage = {
      id: "msg-process",
      role: "assistant",
      parts: [
        {
          type: "reasoning",
          text: "先分析需求",
          state: "streaming",
        },
        {
          type: "tool-searchRecords",
          state: "input-available",
          toolCallId: "tool-1",
          input: {
            query: "销售额",
          },
        },
        {
          type: "text",
          text: "正在整理结果",
          state: "streaming",
        },
      ],
    }

    render(<MessageParts message={message} />)

    expect(screen.getByTestId("assistant-stream-state")).toHaveAttribute(
      "data-status",
      "正在生成回复"
    )
    expect(screen.getByTestId("assistant-stream-state")).toHaveAttribute(
      "data-streaming",
      "true"
    )
    expect(screen.getByTestId("assistant-stream-state")).toHaveTextContent(
      "正在分析问题|正在查询数据|正在生成回复"
    )
  })

  it("应将 tool-generateChart 的结果交给 ChartRenderer 渲染", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-generateChart",
          state: "output-available",
          input: {
            type: "bar",
            title: "销售额",
          },
          output: {
            title: { text: "销售额" },
            xAxis: { type: "category", data: ["华东", "华南"] },
            yAxis: { type: "value" },
            series: [{ type: "bar", data: [12, 8] }],
          },
        },
      ],
    }

    render(<MessageParts message={message} />)

    expect(screen.getByTestId("chart-renderer")).toBeInTheDocument()
    expect(screen.queryByTestId("tool-output")).not.toBeInTheDocument()
    expect(chartRendererMock).toHaveBeenCalled()
  })

  it("应从文本中的图表 JSON 兜底渲染图表", () => {
    const message: UIMessage = {
      id: "msg-2",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: `已生成图表\n\n\`\`\`json
{
  "title": "月度销量",
  "type": "bar",
  "xAxis": "月份",
  "yAxis": "销量",
  "data": {
    "labels": ["1月", "2月"],
    "values": [12, 18]
  },
  "color": "#5470C6"
}
\`\`\``,
        },
      ],
    }

    render(<MessageParts message={message} />)

    expect(screen.getByTestId("chart-renderer")).toBeInTheDocument()
    expect(chartRendererMock).toHaveBeenCalled()
  })
})
