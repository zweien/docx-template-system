import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessageMarkdown } from "./message-markdown";

describe("MessageMarkdown", () => {
  it("应渲染标题和列表", () => {
    render(<MessageMarkdown content={"# 标题\n\n- 项目一\n- 项目二"} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "标题",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("项目一")).toBeInTheDocument();
  });

  it("应渲染代码块内容", () => {
    render(
      <MessageMarkdown
        content={"```ts\nconst answer = 42;\n```"}
        isStreaming
      />
    );

    expect(screen.getByText("const answer = 42;")).toBeInTheDocument();
  });
});
