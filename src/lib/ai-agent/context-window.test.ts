import { describe, expect, it } from "vitest";

import {
  buildConversationContext,
  selectRecentMessages,
  summarizeAttachmentContext,
} from "./context-window";

describe("context-window", () => {
  it("selectRecentMessages 应保留最近 N 条消息", () => {
    const messages = Array.from({ length: 6 }, (_, index) => ({
      id: `msg-${index + 1}`,
      role: index % 2 === 0 ? "user" : "assistant",
      content: `内容 ${index + 1}`,
    }));

    expect(selectRecentMessages(messages, 4).map((message) => message.id)).toEqual([
      "msg-3",
      "msg-4",
      "msg-5",
      "msg-6",
    ]);
  });

  it("summarizeAttachmentContext 应截断过长摘要", () => {
    const summary = summarizeAttachmentContext([
      {
        id: "att-1",
        fileName: "brief.txt",
        extractSummary: "A".repeat(300),
      },
    ]);

    expect(summary).toContain("brief.txt");
    expect(summary.length).toBeLessThan(280);
  });

  it("buildConversationContext 应组合消息和附件摘要", () => {
    const context = buildConversationContext({
      history: [
        { id: "u1", role: "user", content: "请总结附件" },
        { id: "a1", role: "assistant", content: "好的" },
      ],
      attachments: [
        { id: "att-1", fileName: "note.md", extractSummary: "这是一份会议纪要" },
      ],
      limit: 2,
    });

    expect(context).toContain("请总结附件");
    expect(context).toContain("会议纪要");
  });
});
