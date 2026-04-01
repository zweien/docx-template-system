"use client"

import { useChat } from "@ai-sdk/react"
import { useCallback, useEffect, useState } from "react"
import { DefaultChatTransport } from "ai"

// AI Elements
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation"
import { PromptInput, PromptInputTextarea, PromptInputSubmit, PromptInputFooter, PromptInputProvider } from "@/components/ai-elements/prompt-input"
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion"
import { Message, MessageContent } from "@/components/ai-elements/message"

import { MessageParts } from "./message-parts"
import { Button } from "@/components/ui/button"
import { PanelLeftClose, PanelLeft, Sparkles } from "lucide-react"

interface ChatAreaProps {
  conversationId: string
  onToggleSidebar: () => void
  sidebarCollapsed: boolean
}

const SUGGESTIONS = [
  "帮我查看系统中有哪些数据表",
  "搜索销售记录中金额大于1000的记录",
  "帮我生成一份月度销售统计图表",
  "查看可用的文档模板",
]

export function ChatArea({ conversationId, onToggleSidebar, sidebarCollapsed }: ChatAreaProps) {
  const [model, setModel] = useState("gpt-4o")

  // Load user's default model from settings
  useEffect(() => {
    fetch("/api/agent2/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.defaultModel) {
          setModel(data.data.defaultModel)
        }
      })
      .catch(() => {
        // Use fallback model
      })
  }, [])

  const {
    messages,
    status,
    sendMessage,
    stop,
    error,
    addToolOutput,
  } = useChat({
    id: conversationId,
    transport: new DefaultChatTransport({
      api: `/api/agent2/conversations/${conversationId}/chat`,
      body: { model },
    }),
  })

  const handleSubmit = useCallback(
    async ({ text }: { text: string; files?: Array<any> }) => {
      if (!text.trim()) return
      await sendMessage({ text })
    },
    [sendMessage]
  )

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      handleSubmit({ text: suggestion })
    },
    [handleSubmit]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <Button variant="ghost" size="icon-xs" onClick={onToggleSidebar}>
          {sidebarCollapsed ? (
            <PanelLeft className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </Button>
        <span className="text-sm font-medium truncate">AI 助手</span>
        <span className="text-xs text-muted-foreground">{model}</span>
      </div>

      {/* Messages */}
      <Conversation className="flex-1">
        {messages.length === 0 ? (
          <ConversationContent>
            <ConversationEmptyState
              title="开始新对话"
              description="问我任何关于数据表、模板或记录的问题"
              icon={<Sparkles className="size-12 text-muted-foreground/50" />}
            >
              <div className="mt-4">
                <Suggestions>
                  {SUGGESTIONS.map((s) => (
                    <Suggestion key={s} suggestion={s} onClick={handleSuggestionClick} />
                  ))}
                </Suggestions>
              </div>
            </ConversationEmptyState>
          </ConversationContent>
        ) : (
          <ConversationContent>
            {messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  <MessageParts
                    message={message}
                    onToolConfirm={({ toolCallId, toolName, result }) => {
                      addToolOutput({
                        tool: toolName as "dynamic",
                        toolCallId,
                        output: result,
                      })
                    }}
                  />
                </MessageContent>
              </Message>
            ))}
          </ConversationContent>
        )}
        <ConversationScrollButton />
      </Conversation>

      {/* Input area */}
      <div className="shrink-0 border-t p-4">
        <PromptInputProvider>
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea placeholder="输入消息..." />
            <PromptInputFooter>
              <PromptInputSubmit status={status} onStop={stop} />
            </PromptInputFooter>
          </PromptInput>
        </PromptInputProvider>
      </div>

      {error && (
        <div className="px-4 py-2 text-sm text-destructive bg-destructive/10">
          {error.message || "发生错误"}
        </div>
      )}
    </div>
  )
}
