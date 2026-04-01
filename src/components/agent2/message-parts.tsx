"use client"

import type { UIMessage, DynamicToolUIPart } from "ai"
import { MessageResponse } from "@/components/ai-elements/message"
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning"
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool"
import { Sources, SourcesTrigger, SourcesContent, Source } from "@/components/ai-elements/sources"
import { Attachments, Attachment, AttachmentPreview } from "@/components/ai-elements/attachments"

interface MessagePartsProps {
  message: UIMessage
}

export function MessageParts({ message }: MessagePartsProps) {
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

          case "file":
            return (
              <Attachments key={index} variant="inline">
                <Attachment data={{
                  id: `file-${index}`,
                  type: "file" as const,
                  url: (part as any).url,
                  mediaType: (part as any).mediaType,
                  filename: (part as any).filename,
                }}>
                  <AttachmentPreview />
                </Attachment>
              </Attachments>
            )

          case "dynamic-tool": {
            const toolPart = part as DynamicToolUIPart
            const toolState = toolPart.state

            // Check for needs-confirm from tool output
            if ((toolPart as any).output?._needsConfirm) {
              return (
                <Tool key={index}>
                  <ToolHeader
                    type="dynamic-tool"
                    state="approval-requested"
                    toolName={toolPart.toolName}
                  />
                  <ToolContent>
                    <div className="space-y-3 p-3">
                      <p className="text-sm text-muted-foreground">{(toolPart as any).output.riskMessage}</p>
                      <ToolInput input={(toolPart as any).output.toolInput} />
                      <div className="flex gap-2">
                        <button
                          className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md"
                          onClick={async () => {
                            try {
                              await fetch(`/api/agent2/confirm/${(toolPart as any).output.token}`, {
                                method: "POST",
                                body: JSON.stringify({ approved: true }),
                                headers: { "Content-Type": "application/json" },
                              })
                            } catch (e) {
                              console.error("Failed to confirm tool:", e)
                            }
                          }}
                        >
                          确认执行
                        </button>
                        <button
                          className="px-3 py-1.5 text-sm border rounded-md"
                          onClick={async () => {
                            try {
                              await fetch(`/api/agent2/confirm/${(toolPart as any).output.token}`, {
                                method: "POST",
                                body: JSON.stringify({ approved: false }),
                                headers: { "Content-Type": "application/json" },
                              })
                            } catch (e) {
                              console.error("Failed to reject tool:", e)
                            }
                          }}
                        >
                          拒绝
                        </button>
                      </div>
                    </div>
                  </ToolContent>
                </Tool>
              )
            }

            // Check for chart tool with output
            if (toolPart.toolName === "generateChart" && toolState === "output-available") {
              return (
                <Tool key={index}>
                  <ToolHeader type="dynamic-tool" state={toolState} toolName={toolPart.toolName} />
                  <ToolContent>
                    <ChartPlaceholder option={(toolPart as any).output} />
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
                    <ToolOutput output={(toolPart as any).output} errorText={(toolPart as any).errorText} />
                  )}
                  {toolState === "output-error" && (
                    <ToolOutput output={null} errorText={(toolPart as any).errorText} />
                  )}
                </ToolContent>
              </Tool>
            )
          }

          default:
            // Handle tool-${name} parts (static ToolUIPart from AI SDK)
            if (part.type.startsWith("tool-")) {
              const toolPart = part as any
              const toolName = part.type.replace("tool-", "")
              const toolState = toolPart.state as DynamicToolUIPart["state"]

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
    </>
  )
}

function ChartPlaceholder({ option }: { option: any }) {
  return (
    <div className="border rounded-lg p-4 text-center text-muted-foreground text-sm">
      图表：{option?.title || "未命名图表"}
      <br />
      <span className="text-xs">（图表渲染将在 Task 8 中实现）</span>
    </div>
  )
}
