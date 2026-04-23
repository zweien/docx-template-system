"use client"

import { useState } from "react"
import type { ChatStatus, UIMessage, DynamicToolUIPart, FileUIPart, ToolUIPart } from "ai"
import { MessageResponse } from "@/components/ai-elements/message"
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning"
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool"
import { Sources, SourcesTrigger, SourcesContent, Source } from "@/components/ai-elements/sources"
import { Attachments, Attachment, AttachmentPreview } from "@/components/ai-elements/attachments"
import { ToolConfirmDialog } from "./tool-confirm-dialog"
import { ChartRenderer } from "./chart-renderer"
import { parseThinkTaggedText } from "@/lib/agent2/think-parser"
import { extractChartOptionFromText } from "@/lib/agent2/chart-text-parser"
import { AssistantStreamState } from "../ai-chat/assistant-stream-state"

interface DetailPreview {
  title: string
  type: "record" | "paper" | "template" | "code" | "generic"
  fields?: Array<{ label: string; value: string }>
  summary?: string
  recordCount?: number
  items?: Array<{ id: string; label: string }>
}

interface ConfirmState {
  open: boolean
  toolName: string
  toolCallId: string
  toolInput: Record<string, unknown>
  riskMessage: string
  token: string
  detailPreview?: DetailPreview | null
}

interface ConfirmToolOutput {
  _needsConfirm: true
  riskMessage: string
  toolInput: Record<string, unknown>
  token: string
  detailPreview?: DetailPreview | null
}

interface MessagePartsProps {
  message: UIMessage
  chatStatus?: ChatStatus
  onToolConfirm?: (params: {
    toolCallId: string
    toolName: string
    result: unknown
  }) => void
}

function getToolProgressLabel(toolName: string) {
  switch (toolName) {
    case "listTables":
      return "正在查看数据表"
    case "getTableSchema":
      return "正在读取表结构"
    case "searchRecords":
      return "正在查询数据"
    case "aggregateRecords":
      return "正在汇总统计"
    case "generateChart":
      return "正在生成图表"
    case "listTemplates":
    case "getTemplate":
      return "正在读取模板"
    default:
      if (toolName.startsWith("mcp__")) {
        const serverName = toolName.split("__")[1] || "";
        return `正在调用 ${serverName} 工具`;
      }
      return "正在处理工具调用"
  }
}

function getMessageProgress(message: UIMessage, chatStatus?: ChatStatus) {
  if (message.role !== "assistant" || !message.parts || message.parts.length === 0) {
    return null
  }

  const timeline: string[] = []
  const pushStep = (step: string) => {
    if (timeline[timeline.length - 1] !== step) {
      timeline.push(step)
    }
  }

  let isStreaming = false
  let hasVisibleText = false

  for (const part of message.parts) {
    if (part.type === "reasoning") {
      pushStep("正在分析问题")
      if (part.state === "streaming") {
        isStreaming = true
      }
      continue
    }

    if (part.type === "text") {
      const segments = parseThinkTaggedText(part.text)
      if (segments.some((segment) => segment.type === "reasoning")) {
        pushStep("正在分析问题")
      }
      if (segments.some((segment) => segment.type === "text" && segment.text.trim().length > 0)) {
        pushStep("正在生成回复")
        hasVisibleText = true
      }
      if (part.state === "streaming") {
        isStreaming = true
      }
      continue
    }

    if (part.type === "dynamic-tool") {
      pushStep(getToolProgressLabel(part.toolName))
      if (
        part.state === "input-streaming" ||
        part.state === "input-available" ||
        part.state === "approval-requested" ||
        part.state === "approval-responded"
      ) {
        isStreaming = true
      }
      continue
    }

    if (part.type.startsWith("tool-")) {
      pushStep(getToolProgressLabel(part.type.replace("tool-", "")))
      const toolPart = part as { state?: string };
      if (
        toolPart.state === "input-streaming" ||
        toolPart.state === "input-available" ||
        toolPart.state === "approval-requested" ||
        toolPart.state === "approval-responded"
      ) {
        isStreaming = true
      }
    }
  }

  if (timeline.length === 0) {
    return null
  }

  const effectiveStreaming = chatStatus ? chatStatus === "streaming" && isStreaming : isStreaming

  return {
    status: timeline[timeline.length - 1],
    timeline,
    isStreaming: effectiveStreaming,
    hasContent: hasVisibleText,
  }
}

export function MessageParts({ message, chatStatus, onToolConfirm }: MessagePartsProps) {
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    toolName: "",
    toolCallId: "",
    toolInput: {},
    riskMessage: "",
    token: "",
  })

  if (!message.parts || message.parts.length === 0) {
    return null
  }

  // Collect reasoning parts to merge into a single Reasoning block
  const reasoningParts = message.parts.flatMap((part) => {
    if (part.type === "reasoning") {
      return [part]
    }

    if (part.type === "text") {
      return parseThinkTaggedText(part.text)
        .filter((segment) => segment.type === "reasoning")
        .map((segment) => ({
          type: "reasoning" as const,
          text: segment.text,
        }))
    }

    return []
  }) as Array<{
    type: "reasoning"
    text: string
    state?: string
  }>
  const reasoningText = reasoningParts.map((p) => p.text).join("")
  const isReasoningStreaming = reasoningParts.some((p) => p.state === "streaming")
  const messageProgress = getMessageProgress(message, chatStatus)

  return (
    <>
      {messageProgress && (
        <AssistantStreamState
          status={messageProgress.status}
          timeline={messageProgress.timeline}
          isStreaming={messageProgress.isStreaming}
          hasContent={messageProgress.hasContent}
        />
      )}

      {/* Reasoning section */}
      {reasoningText && (
        <Reasoning isStreaming={isReasoningStreaming}>
          <ReasoningTrigger getThinkingMessage={() => <p>思维过程</p>} />
          <ReasoningContent>{reasoningText}</ReasoningContent>
        </Reasoning>
      )}

      {/* Render each part */}
      {message.parts.map((part, index) => {
        switch (part.type) {
          case "text": {
            const textParts = parseThinkTaggedText(part.text)
              .filter((segment) => segment.type === "text")
              .map((segment) => segment.text)
            if (textParts.length === 0) {
              return null
            }
            const textContent = textParts.join("\n\n")
            const chartOption = extractChartOptionFromText(textContent)

            return (
              <div key={index} className="space-y-4">
                {chartOption && <ChartRenderer option={chartOption} />}
                <MessageResponse>{textContent}</MessageResponse>
              </div>
            )
          }

          case "reasoning":
            // Already handled above as merged block
            return null

          case "source-url":
          case "source-document":
            // Sources rendered collectively below
            return null

          case "file": {
            const filePart = part as FileUIPart
            return (
              <Attachments key={index} variant="inline">
                <Attachment data={{
                  id: `file-${index}`,
                  type: "file" as const,
                  url: filePart.url,
                  mediaType: filePart.mediaType,
                  filename: filePart.filename,
                }}>
                  <AttachmentPreview />
                </Attachment>
              </Attachments>
            )
          }

          case "dynamic-tool": {
            const toolPart = part as DynamicToolUIPart
            const toolState = toolPart.state

            // Check for needs-confirm from tool output
            const toolOutput = toolState === "output-available" ? (toolPart as DynamicToolUIPart & { state: "output-available"; output: unknown }).output : undefined
            if (toolOutput && typeof toolOutput === "object" && toolOutput !== null && "_needsConfirm" in toolOutput) {
              const confirmOutput = toolOutput as ConfirmToolOutput
              return (
                <Tool key={index} open>
                  <ToolHeader
                    type="dynamic-tool"
                    state="approval-requested"
                    toolName={toolPart.toolName}
                  />
                  <ToolContent>
                    <div className="space-y-3 p-3">
                      <p className="text-sm text-muted-foreground">{confirmOutput.riskMessage}</p>
                      <ToolInput input={confirmOutput.toolInput} />
                      <button
                        className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md"
                        onClick={() => {
                          setConfirmState({
                            open: true,
                            toolName: toolPart.toolName,
                            toolCallId: toolPart.toolCallId,
                            toolInput: confirmOutput.toolInput,
                            riskMessage: confirmOutput.riskMessage,
                            token: confirmOutput.token,
                            detailPreview: confirmOutput.detailPreview,
                          })
                        }}
                      >
                        查看详情并确认
                      </button>
                    </div>
                  </ToolContent>
                </Tool>
              )
            }

            // Check for chart tool with output
            if (toolPart.toolName === "generateChart" && toolState === "output-available") {
              const chartOutput = (toolPart as DynamicToolUIPart & { state: "output-available"; output: unknown }).output
              return (
                <Tool key={index} defaultOpen>
                  <ToolHeader type="dynamic-tool" state={toolState} toolName={toolPart.toolName} />
                  <ToolContent>
                    <ChartRenderer option={chartOutput as Record<string, unknown>} />
                  </ToolContent>
                </Tool>
              )
            }

            // Standard tool rendering
            return (
              <Tool key={index}>
                <ToolHeader type="dynamic-tool" state={toolState} toolName={toolPart.toolName} />
                <ToolContent>
                  <ToolInput input={toolPart.input} />
                  {toolState === "output-available" && (
                    <ToolOutput output={(toolPart as DynamicToolUIPart & { state: "output-available" }).output} errorText={undefined} />
                  )}
                  {toolState === "output-error" && (
                    <ToolOutput output={null} errorText={(toolPart as DynamicToolUIPart & { state: "output-error" }).errorText} />
                  )}
                </ToolContent>
              </Tool>
            )
          }

          default:
            // Handle tool-${name} parts (static ToolUIPart from AI SDK)
            if (part.type.startsWith("tool-")) {
              const toolPart = part as ToolUIPart
              const toolName = part.type.replace("tool-", "")
              const toolState = toolPart.state

              // Check for needs-confirm from tool output
              if (toolState === "output-available" && toolPart.output && typeof toolPart.output === "object" && toolPart.output !== null && "_needsConfirm" in toolPart.output) {
                const confirmOutput = toolPart.output as ConfirmToolOutput
                return (
                  <Tool key={index} open>
                    <ToolHeader
                      type="dynamic-tool"
                      state="approval-requested"
                      toolName={toolName}
                    />
                    <ToolContent>
                      <div className="space-y-3 p-3">
                        <p className="text-sm text-muted-foreground">{confirmOutput.riskMessage}</p>
                        <ToolInput input={confirmOutput.toolInput} />
                        <button
                          className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md"
                          onClick={() => {
                            setConfirmState({
                              open: true,
                              toolName,
                              toolCallId: toolPart.toolCallId,
                              toolInput: confirmOutput.toolInput,
                              riskMessage: confirmOutput.riskMessage,
                              token: confirmOutput.token,
                              detailPreview: confirmOutput.detailPreview,
                            })
                          }}
                        >
                          查看详情并确认
                        </button>
                      </div>
                    </ToolContent>
                  </Tool>
                )
              }

              if (toolName === "generateChart" && toolState === "output-available") {
                return (
                  <Tool key={index} defaultOpen>
                    <ToolHeader type="dynamic-tool" state={toolState} toolName={toolName} />
                    <ToolContent>
                      <ChartRenderer option={toolPart.output as Record<string, unknown>} />
                    </ToolContent>
                  </Tool>
                )
              }

              return (
                <Tool key={index}>
                  <ToolHeader type="dynamic-tool" state={toolState} toolName={toolName} />
                  <ToolContent>
                    <ToolInput input={toolPart.input} />
                    {toolState === "output-available" && (
                      <ToolOutput output={toolPart.output} errorText={toolPart.errorText} />
                    )}
                    {toolState === "output-error" && (
                      <ToolOutput output={null} errorText={toolPart.errorText} />
                    )}
                  </ToolContent>
                </Tool>
              )
            }

            return null
        }
      })}

      {/* Sources section - rendered collectively */}
      {(() => {
        const sourceUrlParts = message.parts.filter((p) => p.type === "source-url") as Array<{
          type: "source-url"
          url: string
          title?: string
        }>
        const sourceDocParts = message.parts.filter((p) => p.type === "source-document") as Array<{
          type: "source-document"
          title: string
          filename?: string
        }>

        const totalCount = sourceUrlParts.length + sourceDocParts.length
        if (totalCount === 0) return null

        return (
          <Sources>
            <SourcesTrigger count={totalCount} />
            <SourcesContent>
              {sourceUrlParts.map((part, i) => (
                <Source key={`url-${i}`} href={part.url} title={part.title || part.url} />
              ))}
              {sourceDocParts.map((part, i) => (
                <Source key={`doc-${i}`} href="#" title={part.title || part.filename || "Document"} />
              ))}
            </SourcesContent>
          </Sources>
        )
      })()}

      {/* Tool confirm dialog */}
      <ToolConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState(prev => ({ ...prev, open }))}
        toolName={confirmState.toolName}
        toolInput={confirmState.toolInput}
        riskMessage={confirmState.riskMessage}
        token={confirmState.token}
        toolCallId={confirmState.toolCallId}
        detailPreview={confirmState.detailPreview}
        onConfirm={(result) => {
          setConfirmState(prev => ({ ...prev, open: false }))
          if (onToolConfirm && confirmState.toolCallId) {
            onToolConfirm({
              toolCallId: confirmState.toolCallId,
              toolName: confirmState.toolName,
              result,
            })
          }
        }}
        onReject={() => setConfirmState(prev => ({ ...prev, open: false }))}
      />
    </>
  )
}
