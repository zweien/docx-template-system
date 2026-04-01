"use client"

import { useState } from "react"
import type { UIMessage, DynamicToolUIPart, FileUIPart, ToolUIPart } from "ai"
import { MessageResponse } from "@/components/ai-elements/message"
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning"
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool"
import { Sources, SourcesTrigger, SourcesContent, Source } from "@/components/ai-elements/sources"
import { Attachments, Attachment, AttachmentPreview } from "@/components/ai-elements/attachments"
import { ToolConfirmDialog } from "./tool-confirm-dialog"
import { ChartRenderer } from "./chart-renderer"

interface ConfirmState {
  open: boolean
  toolName: string
  toolCallId: string
  toolInput: Record<string, unknown>
  riskMessage: string
  token: string
  toolCategory: string
}

interface ConfirmToolOutput {
  _needsConfirm: true
  riskMessage: string
  toolInput: Record<string, unknown>
  token: string
  toolCategory?: string
}

interface MessagePartsProps {
  message: UIMessage
  onToolConfirm?: (params: {
    toolCallId: string
    toolName: string
    result: unknown
  }) => void
}

export function MessageParts({ message, onToolConfirm }: MessagePartsProps) {
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    toolName: "",
    toolCallId: "",
    toolInput: {},
    riskMessage: "",
    token: "",
    toolCategory: "",
  })

  if (!message.parts || message.parts.length === 0) {
    return null
  }

  // Collect reasoning parts to merge into a single Reasoning block
  const reasoningParts = message.parts.filter((p) => p.type === "reasoning") as Array<{
    type: "reasoning"
    text: string
    state?: string
  }>
  const reasoningText = reasoningParts.map((p) => p.text).join("")
  const isReasoningStreaming = reasoningParts.some((p) => p.state === "streaming")

  return (
    <>
      {/* Reasoning section */}
      {reasoningText && (
        <Reasoning isStreaming={isReasoningStreaming}>
          <ReasoningTrigger />
          <ReasoningContent>{reasoningText}</ReasoningContent>
        </Reasoning>
      )}

      {/* Render each part */}
      {message.parts.map((part, index) => {
        switch (part.type) {
          case "text":
            return <MessageResponse key={index}>{part.text}</MessageResponse>

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
                <Tool key={index}>
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
                            toolCategory: confirmOutput.toolCategory || "execute",
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
                <Tool key={index}>
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
        toolCategory={confirmState.toolCategory}
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
