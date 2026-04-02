import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Agent2Layout } from "./agent2-layout"

const sidebarPropsMock = vi.hoisted(() => ({
  latest: null as null | {
    selectedId: string | null
    onSelect: (id: string | null) => void
  },
}))

vi.mock("./conversation-sidebar", () => ({
  ConversationSidebar: (props: {
    selectedId: string | null
    onSelect: (id: string | null) => void
  }) => {
    sidebarPropsMock.latest = props
    return (
      <div>
        <div data-testid="sidebar-selected">{props.selectedId ?? "none"}</div>
        <button type="button" onClick={() => props.onSelect("conv-2")}>
          选择会话
        </button>
      </div>
    )
  },
}))

vi.mock("./chat-area", () => ({
  ChatArea: ({ conversationId }: { conversationId: string }) => (
    <div data-testid="chat-area">{conversationId}</div>
  ),
}))

vi.mock("./settings-dialog", () => ({
  SettingsDialog: () => null,
}))

describe("Agent2Layout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sidebarPropsMock.latest = null
    window.localStorage.clear()
  })

  it("刷新后应恢复上次选中的会话", async () => {
    window.localStorage.setItem("agent2:selectedConversationId", "conv-1")

    render(<Agent2Layout />)

    await waitFor(() => {
      expect(screen.getByTestId("chat-area")).toHaveTextContent("conv-1")
    })
  })

  it("切换会话后应持久化当前选中项", async () => {
    render(<Agent2Layout />)

    fireEvent.click(screen.getByRole("button", { name: "选择会话" }))

    await waitFor(() => {
      expect(window.localStorage.getItem("agent2:selectedConversationId")).toBe("conv-2")
      expect(screen.getByTestId("chat-area")).toHaveTextContent("conv-2")
    })
  })
})
