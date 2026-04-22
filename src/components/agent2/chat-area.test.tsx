import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createContext, useContext, useState, type FormEvent, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ChatArea } from "./chat-area"
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input"
import type { FileUIPart } from "ai"

const {
  sendMessageMock,
  stopMock,
  addToolOutputMock,
  setMessagesMock,
  fetchMock,
  uploadAgent2FilesMock,
  buildAttachmentMessageTextMock,
  mockState,
} = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
  stopMock: vi.fn(),
  addToolOutputMock: vi.fn(),
  setMessagesMock: vi.fn(),
  fetchMock: vi.fn(),
  uploadAgent2FilesMock: vi.fn(),
  buildAttachmentMessageTextMock: vi.fn(),
  mockState: {
    selectedFiles: [] as FileUIPart[],
  },
}))
const PromptInputControllerContext = createContext<{
  value: string
  setValue: (value: string) => void
} | null>(null)
const openFileDialogMock = vi.fn()

vi.mock("@ai-sdk/react", () => ({
  useChat: vi.fn(() => ({
    messages: [],
    status: "ready",
    sendMessage: sendMessageMock,
    stop: stopMock,
    error: undefined,
    addToolOutput: addToolOutputMock,
    setMessages: setMessagesMock,
  })),
}))

vi.mock("ai", () => ({
  DefaultChatTransport: class DefaultChatTransport {
    constructor(_options: unknown) {}
  },
}))

vi.mock("@/components/ai-elements/conversation", () => ({
  Conversation: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConversationContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConversationEmptyState: ({
    children,
    title,
    description,
  }: {
    children?: ReactNode
    title: string
    description: string
  }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
      {children}
    </div>
  ),
  ConversationScrollButton: () => null,
}))

vi.mock("@/components/ai-elements/message", () => ({
  Message: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MessageContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("./message-parts", () => ({
  MessageParts: () => null,
}))

vi.mock("@/components/ai-elements/attachments", () => ({
  Attachments: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Attachment: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AttachmentPreview: () => <div>AttachmentPreview</div>,
  AttachmentInfo: () => <div>AttachmentInfo</div>,
  AttachmentRemove: ({ label }: { label?: string }) => (
    <button type="button">{label ?? "Remove"}</button>
  ),
}))

vi.mock("@/lib/agent2/file-attachments", () => ({
  uploadAgent2Files: uploadAgent2FilesMock,
  buildAttachmentMessageText: buildAttachmentMessageTextMock,
}))

vi.mock("@/components/ai-elements/prompt-input", () => {
  function PromptInputProvider({ children }: { children: ReactNode }) {
    return <>{children}</>
  }

  function PromptInput({
    children,
    onSubmit,
  }: {
    children: ReactNode
    onSubmit: (
      payload: PromptInputMessage,
      event: FormEvent<HTMLFormElement>
    ) => void | Promise<void>
  }) {
    const [value, setValue] = useState("")

    return (
      <PromptInputControllerContext.Provider value={{ value, setValue }}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const result = onSubmit({ text: value, files: mockState.selectedFiles }, event)
            if (result instanceof Promise) {
              void result.then(() => setValue(""))
            } else {
              setValue("")
            }
          }}
        >
          {children}
        </form>
      </PromptInputControllerContext.Provider>
    )
  }

  function PromptInputTextarea({
    placeholder,
    disabled,
  }: {
    placeholder?: string
    disabled?: boolean
  }) {
    const controller = useContext(PromptInputControllerContext)
    if (!controller) {
      throw new Error("PromptInputTextarea must be used within PromptInput")
    }

    return (
      <textarea
        placeholder={placeholder}
        disabled={disabled}
        value={controller.value}
        onChange={(event) => controller.setValue(event.target.value)}
      />
    )
  }

  function PromptInputSubmit(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return <button type="submit" {...props}>Submit</button>
  }

  function PromptInputHeader({ children }: { children: ReactNode }) {
    return <div>{children}</div>
  }

  function PromptInputFooter({ children }: { children: ReactNode }) {
    return <div>{children}</div>
  }

  function PromptInputTools({ children }: { children: ReactNode }) {
    return <div>{children}</div>
  }

  function PromptInputButton(
    props: React.ButtonHTMLAttributes<HTMLButtonElement>
  ) {
    return <button type="button" {...props} />
  }

  function usePromptInputAttachments() {
    return {
      files: mockState.selectedFiles.map((file, index) => ({
        ...file,
        id: `file-${index}`,
      })),
      openFileDialog: openFileDialogMock,
      remove: vi.fn(),
    }
  }

  return {
    PromptInput,
    PromptInputButton,
    PromptInputTextarea,
    PromptInputSubmit,
    PromptInputFooter,
    PromptInputHeader,
    PromptInputProvider,
    PromptInputTools,
    usePromptInputAttachments,
  }
})

describe("ChatArea", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.selectedFiles = []
    openFileDialogMock.mockReset()
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url === "/api/agent2/settings") {
        return {
          json: async () => ({
            success: true,
            data: { defaultModel: "MiniMax-M2.5" },
          }),
        }
      }

      if (url === "/api/agent2/conversations/conv-1") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: "conv-1",
              messages: [],
            },
          }),
        }
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal("fetch", fetchMock)
  })

  async function waitForHistoryReady() {
    await waitFor(() => {
      expect(screen.getByPlaceholderText("输入消息...")).not.toBeDisabled()
    })
  }

  it("进入会话后应加载历史消息", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url === "/api/agent2/settings") {
        return {
          json: async () => ({
            success: true,
            data: { defaultModel: "MiniMax-M2.5" },
          }),
        }
      }

      if (url === "/api/agent2/conversations/conv-1") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: "conv-1",
              messages: [
                {
                  id: "msg-1",
                  role: "user",
                  parts: [{ type: "text", text: "历史问题" }],
                },
                {
                  id: "msg-2",
                  role: "assistant",
                  parts: [{ type: "text", text: "历史回答" }],
                },
              ],
            },
          }),
        }
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    render(
      <ChatArea
        conversationId="conv-1"
        onToggleSidebar={vi.fn()}
        sidebarCollapsed={false}
      />
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/agent2/conversations/conv-1")
      expect(setMessagesMock).toHaveBeenCalledWith([
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "历史问题" }],
        },
        {
          id: "msg-2",
          role: "assistant",
          parts: [{ type: "text", text: "历史回答" }],
        },
      ])
    })
  })

  it("历史消息加载完成前应禁止发送，避免覆盖新消息", async () => {
    let resolveConversation: ((value: unknown) => void) | null = null

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)

      if (url === "/api/agent2/settings") {
        return Promise.resolve({
          json: async () => ({
            success: true,
            data: { defaultModel: "MiniMax-M2.5" },
          }),
        })
      }

      if (url === "/api/agent2/conversations/conv-1") {
        return new Promise((resolve) => {
          resolveConversation = resolve
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    render(
      <ChatArea
        conversationId="conv-1"
        onToggleSidebar={vi.fn()}
        sidebarCollapsed={false}
      />
    )

    const textarea = screen.getByPlaceholderText("正在加载历史消息...")
    const submitButton = screen.getByRole("button", { name: "Submit" })
    const attachmentButton = screen.getByRole("button", { name: "添加附件" })

    expect(textarea).toBeDisabled()
    expect(submitButton).toBeDisabled()
    expect(attachmentButton).toBeDisabled()

    if (!resolveConversation) {
      throw new Error("历史消息请求未进入挂起状态")
    }

    const resolvePendingConversation = resolveConversation as (value: unknown) => void

    resolvePendingConversation({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: "conv-1", messages: [] },
      }),
    })

    await waitFor(() => {
      expect(screen.getByPlaceholderText("输入消息...")).not.toBeDisabled()
      expect(submitButton).not.toBeDisabled()
      expect(attachmentButton).not.toBeDisabled()
    })
  })

  it("发送后应立即清空输入框，不等待模型流式返回", async () => {
    sendMessageMock.mockReturnValue(new Promise(() => {}))

    render(
      <ChatArea
        conversationId="conv-1"
        onToggleSidebar={vi.fn()}
        sidebarCollapsed={false}
      />
    )

    await waitForHistoryReady()

    const textarea = screen.getByPlaceholderText("输入消息...")
    fireEvent.change(textarea, {
      target: { value: "请帮我分析销售数据" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Submit" }))

    expect(sendMessageMock).toHaveBeenCalledWith({ text: "请帮我分析销售数据" })
    expect(textarea).toHaveValue("")
  })

  it("点击附件按钮应打开文件选择", async () => {
    render(
      <ChatArea
        conversationId="conv-1"
        onToggleSidebar={vi.fn()}
        sidebarCollapsed={false}
      />
    )

    await waitForHistoryReady()

    fireEvent.click(screen.getByRole("button", { name: "添加附件" }))

    expect(openFileDialogMock).toHaveBeenCalledTimes(1)
  })

  it("发送附件时应上传并把提取文本并入消息", async () => {
    mockState.selectedFiles = [
      {
        type: "file",
        filename: "sales.csv",
        mediaType: "text/csv",
        url: "blob:mock-sales",
      },
    ]
    uploadAgent2FilesMock.mockResolvedValue([
      {
        text: "name,amount",
        fileName: "sales.csv",
        fileType: "csv",
      },
    ])
    buildAttachmentMessageTextMock.mockReturnValue("请分析\n\n## 当前消息附件内容\n\n...")
    sendMessageMock.mockResolvedValue(undefined)

    render(
      <ChatArea
        conversationId="conv-1"
        onToggleSidebar={vi.fn()}
        sidebarCollapsed={false}
      />
    )

    await waitForHistoryReady()

    fireEvent.change(screen.getByPlaceholderText("输入消息..."), {
      target: { value: "请分析" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Submit" }))

    expect(screen.getByPlaceholderText("输入消息...")).toHaveValue("")

    await waitFor(() => {
      expect(uploadAgent2FilesMock).toHaveBeenCalledWith(mockState.selectedFiles)
      expect(buildAttachmentMessageTextMock).toHaveBeenCalledWith("请分析", [
        {
          text: "name,amount",
          fileName: "sales.csv",
          fileType: "csv",
        },
      ])
      expect(sendMessageMock).toHaveBeenCalledWith({
        text: "请分析\n\n## 当前消息附件内容\n\n...",
      })
    })
  })

  it("应显示附件按钮", async () => {
    render(
      <ChatArea
        conversationId="conv-1"
        onToggleSidebar={vi.fn()}
        sidebarCollapsed={false}
      />
    )

    await waitForHistoryReady()

    expect(
      screen
        .getAllByRole("button")
        .some((button) => button.getAttribute("aria-label") === "添加附件")
    ).toBe(true)
  })
})
