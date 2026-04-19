import type { AnchorHTMLAttributes } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DraftCard } from "./draft-card";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/(dashboard)/drafts/delete-draft-button", () => ({
  DeleteDraftButton: () => <button type="button">删除</button>,
}));

describe("DraftCard", () => {
  it("点击卡片应跳转到草稿编辑页", () => {
    render(
      <DraftCard
        id="d1"
        templateId="t1"
        templateName="测试模板"
        formData={{ name: "张三" }}
        updatedAt={new Date("2026-04-19T10:00:00.000Z")}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /测试模板/ }));

    expect(push).toHaveBeenCalledWith("/templates/t1/fill?draftId=d1");
  });

  it("按 Enter 键应跳转到草稿编辑页", () => {
    render(
      <DraftCard
        id="d2"
        templateId="t2"
        templateName="键盘模板"
        formData={{}}
        updatedAt={new Date("2026-04-19T10:00:00.000Z")}
      />
    );

    fireEvent.keyDown(screen.getByRole("button", { name: /键盘模板/ }), { key: "Enter" });

    expect(push).toHaveBeenCalledWith("/templates/t2/fill?draftId=d2");
  });

  it("结构中不应出现嵌套链接", () => {
    const { container } = render(
      <DraftCard
        id="d3"
        templateId="t3"
        templateName="结构模板"
        formData={{}}
        updatedAt={new Date("2026-04-19T10:00:00.000Z")}
      />
    );

    expect(container.querySelectorAll("a a")).toHaveLength(0);
  });
});
