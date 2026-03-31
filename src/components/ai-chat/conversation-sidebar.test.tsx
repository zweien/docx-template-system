import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConversationSidebar } from "./conversation-sidebar";

describe("ConversationSidebar", () => {
  it("应触发选择、新建、重命名和删除动作", () => {
    const onSelect = vi.fn();
    const onCreateConversation = vi.fn();
    const onRenameConversation = vi.fn();
    const onDeleteConversation = vi.fn();

    render(
      <ConversationSidebar
        conversations={[{ id: "conv-1", title: "原始标题" }]}
        currentConversationId="conv-1"
        onSelect={onSelect}
        onCreateConversation={onCreateConversation}
        onRenameConversation={onRenameConversation}
        onDeleteConversation={onDeleteConversation}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "原始标题" }));
    fireEvent.click(screen.getByRole("button", { name: "重命名原始标题" }));
    fireEvent.change(screen.getByDisplayValue("原始标题"), {
      target: { value: "新标题" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存原始标题" }));
    fireEvent.click(screen.getByRole("button", { name: "删除原始标题" }));
    fireEvent.click(screen.getByRole("button", { name: "确认删除原始标题" }));
    fireEvent.click(screen.getByRole("button", { name: "新建对话" }));

    expect(onSelect).toHaveBeenCalledWith("conv-1");
    expect(onRenameConversation).toHaveBeenCalledWith("conv-1", "新标题");
    expect(onDeleteConversation).toHaveBeenCalledWith("conv-1");
    expect(onCreateConversation).toHaveBeenCalled();
  });

  it("删除确认应支持取消", () => {
    const onDeleteConversation = vi.fn();

    render(
      <ConversationSidebar
        conversations={[{ id: "conv-1", title: "原始标题" }]}
        currentConversationId="conv-1"
        onSelect={vi.fn()}
        onCreateConversation={vi.fn()}
        onDeleteConversation={onDeleteConversation}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "删除原始标题" }));
    expect(screen.getByText("确认删除“原始标题”？")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "取消删除原始标题" }));

    expect(onDeleteConversation).not.toHaveBeenCalled();
    expect(screen.queryByText("确认删除“原始标题”？")).not.toBeInTheDocument();
  });
});
