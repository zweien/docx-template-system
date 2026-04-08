"use client"

import { useChat } from "@ai-sdk/react"
import { useCallback, useEffect, useState } from "react"
import { DefaultChatTransport, type FileUIPart, type UIMessage } from "ai"

// AI Elements
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation"
import {
  PromptInput,
  PromptInputButton,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputProvider,
  PromptInputTools,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion"
import { Message, MessageContent } from "@/components/ai-elements/message"
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments"

import { MessageParts } from "./message-parts"
import { Button } from "@/components/ui/button"
import { PanelLeftClose, PanelLeft, Paperclip, Sparkles } from "lucide-react"
import {
  buildAttachmentMessageText,
  uploadAgent2Files,
} from "@/lib/agent2/file-attachments"

interface ChatAreaProps {
  conversationId: string
  onToggleSidebar: () => void
  sidebarCollapsed: boolean
  defaultModel?: string
}

const SUGGESTIONS = [
  "帮我查看系统中有哪些数据表",
  "搜索销售记录中金额大于1000的记录",
  "帮我生成一份月度销售统计图表",
  "查看可用的文档模板",
]

function PromptInputAttachmentsPreview() {
  const attachments = usePromptInputAttachments()

  if (attachments.files.length === 0) {
    return null
  }

  return (
    <Attachments className="w-full" variant="list">
      {attachments.files.map((file) => (
        <Attachment
          key={file.id}
          data={file}
          onRemove={() => attachments.remove(file.id)}
        >
          <AttachmentPreview />
          <AttachmentInfo showMediaType />
          <AttachmentRemove label="移除附件" />
        </Attachment>
      ))}
    </Attachments>
  )
}

function PromptInputAttachmentButton({ disabled = false }: { disabled?: boolean }) {
  const attachments = usePromptInputAttachments()

  return (
    <PromptInputButton
      aria-label="添加附件"
      onClick={() => attachments.openFileDialog()}
      tooltip="添加附件"
      disabled={disabled}
    >
      <Paperclip className="size-4" />
    </PromptInputButton>
  )
}

export function ChatArea({ conversationId, onToggleSidebar, sidebarCollapsed, defaultModel: initialDefaultModel }: ChatAreaProps) {
  const [modelName, setModelName] = useState("MiniMax-M2.5")
  const [model, setModel] = useState("MiniMax-M2.5")
  const [inputError, setInputError] = useState<string | null>(null)
  const [loadedConversationId, setLoadedConversationId] = useState<string | null>(null)

  // 当传入的 defaultModel 变化时，更新 model
  useEffect(() => {
    if (initialDefaultModel && initialDefaultModel !== model) {
      setModel(initialDefaultModel)
    }
  }, [initialDefaultModel])

  const chatKey = `${conversationId}-${model}`

  const {
    messages,
    status,
    sendMessage,
    stop,
    error,
    addToolOutput,
    setMessages,
  } = useChat({
    id: chatKey,
    transport: new DefaultChatTransport({
      api: `/api/agent2/conversations/${conversationId}/chat`,
      body: { model },
    }),
  })

  // Load user's default model from settings
  useEffect(() => {
    fetch("/api/agent2/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.defaultModel) {
          setModel(data.data.defaultModel)
          // 获取模型名称
          return fetch("/api/agent2/models")
        }
        return null
      })
      .then((res) => {
        if (!res) return
        return res.json()
      })
      .then((data) => {
        if (data?.success && data?.data) {
          const models = data.data
          const currentModel = models.find((m: { id: string }) => m.id === model)
          if (currentModel) {
            setModelName(currentModel.name)
          }
        }
      })
      .catch(() => {
        // Use fallback model
      })
  }, [model])

  useEffect(() => {
    let active = true

    void fetch(`/api/agent2/conversations/${conversationId}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("加载历史消息失败")
        }

        return res.json()
      })
      .then((data) => {
        if (!active) {
          return
        }

        const historyMessages: UIMessage[] = Array.isArray(data?.data?.messages)
          ? data.data.messages.map((message: {
              id: string
              role: string
              parts: unknown[]
            }) => ({
              id: message.id,
              role: message.role as UIMessage["role"],
              parts: Array.isArray(message.parts) ? message.parts : [],
            }))
          : []

        setMessages(historyMessages)
        setLoadedConversationId(conversationId)
      })
      .catch(() => {
        if (!active) {
          return
        }

        setMessages([])
        setLoadedConversationId(conversationId)
      })

    return () => {
      active = false
    }
  }, [conversationId, setMessages])

  const historyLoaded = loadedConversationId === conversationId

  const handleSubmit = useCallback(
    ({ text, files }: PromptInputMessage) => {
      if (!historyLoaded) {
        return
      }

      setInputError(null)
      if (!text.trim() && files.length === 0) return

      if (files.length === 0) {
        void sendMessage({ text })
        return
      }

      void (async () => {
        const uploads = await uploadAgent2Files(files as FileUIPart[])
        const messageText = buildAttachmentMessageText(text, uploads)
        await sendMessage({ text: messageText })
      })().catch((error) => {
        setInputError(error instanceof Error ? error.message : "附件上传失败")
      })
    },
    [historyLoaded, sendMessage]
  )

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      handleSubmit({ text: suggestion, files: [] })
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
        <span className="text-xs text-muted-foreground">{modelName}</span>
      </div>

      {/* Messages */}
      <Conversation className="flex-1">
        {!historyLoaded ? (
          <ConversationContent>
            <ConversationEmptyState
              title="正在加载历史消息"
              description="请稍候，正在恢复当前会话内容"
              icon={<Sparkles className="size-12 text-muted-foreground/50" />}
            />
          </ConversationContent>
        ) : messages.length === 0 ? (
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
          <PromptInput
            accept=".csv,.xlsx,.xls,.docx,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onSubmit={handleSubmit}
          >
            <PromptInputHeader>
              <PromptInputAttachmentsPreview />
            </PromptInputHeader>
            <PromptInputTextarea
              placeholder={historyLoaded ? "输入消息..." : "正在加载历史消息..."}
              disabled={!historyLoaded}
            />
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputAttachmentButton disabled={!historyLoaded} />
              </PromptInputTools>
              <PromptInputSubmit status={status} onStop={stop} disabled={!historyLoaded} />
            </PromptInputFooter>
          </PromptInput>
        </PromptInputProvider>
      </div>

      {(error || inputError) && (
        <div className="px-4 py-2 text-sm text-destructive bg-destructive/10">
          {inputError || error?.message || "发生错误"}
        </div>
      )}
    </div>
  )
}
