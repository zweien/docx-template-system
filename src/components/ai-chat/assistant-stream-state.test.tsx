import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AssistantStreamState } from "./assistant-stream-state";

describe("AssistantStreamState", () => {
  it("应展示可折叠的过程时间线", () => {
    render(
      <AssistantStreamState
        status="正在生成回复"
        timeline={["正在分析问题", "正在查询数据", "正在生成回复"]}
        isStreaming
        hasContent
      />
    );

    expect(screen.getByText("3 个步骤")).toBeInTheDocument();
    expect(screen.getByText("正在分析问题")).toBeInTheDocument();
    expect(screen.getByText("正在查询数据")).toBeInTheDocument();
    expect(screen.getAllByText("正在生成回复").length).toBeGreaterThan(0);
  });

  it("完成后应展示完成态", () => {
    render(
      <AssistantStreamState
        status="正在生成回复"
        timeline={["正在分析问题", "正在生成回复"]}
        isStreaming={false}
        hasContent
      />
    );

    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(screen.getByText("2 个步骤")).toBeInTheDocument();
  });

  it("停止后应展示停止态", () => {
    render(
      <AssistantStreamState
        status="已停止生成"
        timeline={["正在分析问题", "正在生成回复", "已停止生成"]}
        isStreaming={false}
      />
    );

    expect(screen.getByText("已停止")).toBeInTheDocument();
    expect(screen.getAllByText("已停止生成").length).toBeGreaterThan(0);
  });
});
