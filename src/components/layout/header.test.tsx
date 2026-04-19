import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./header";

const mockUsePathname = vi.fn();

type DialogProps = {
  readonly open: boolean;
  readonly onClose: () => void;
};

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("@/components/layout/mobile-nav", () => ({
  MobileNav: () => <div data-testid="mobile-nav">mobile-nav</div>,
}));

vi.mock("@/components/layout/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">theme-toggle</div>,
}));

vi.mock("@/components/layout/notification-bell", () => ({
  NotificationBell: () => <div data-testid="notification-bell">notification-bell</div>,
}));

vi.mock("@/components/data/global-search-dialog", () => ({
  GlobalSearchDialog: ({ open, onClose }: DialogProps) => (
    <div data-testid="global-search-dialog" data-open={open ? "true" : "false"}>
      {open ? <button onClick={onClose}>关闭搜索</button> : null}
    </div>
  ),
}));

vi.mock("@/components/layout/navigation/schema", () => ({
  NAV_ITEMS: [
    { id: "home", href: "/", label: "仪表盘" },
    { id: "data", href: "/data", label: "主数据" },
  ],
}));

vi.mock("@/components/layout/navigation/matcher", () => ({
  isRouteActive: (itemHref: string, pathname: string) => {
    if (itemHref === "/") {
      return pathname === "/";
    }

    return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
  },
}));

describe("Header", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
  });

  it("mount/unmount 时应成对注册和卸载 keydown 监听", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = render(<Header />);
    unmount();

    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  it("Ctrl/Cmd + K 应切换全局搜索弹窗", () => {
    render(<Header />);

    const dialog = screen.getByTestId("global-search-dialog");
    expect(dialog).toHaveAttribute("data-open", "false");

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(dialog).toHaveAttribute("data-open", "true");

    fireEvent.keyDown(document, { key: "K", metaKey: true });
    expect(dialog).toHaveAttribute("data-open", "false");
  });

  it("输入框聚焦时不应响应 Ctrl/Cmd + K", () => {
    render(
      <>
        <input aria-label="query" />
        <Header />
      </>
    );

    const input = screen.getByRole("textbox", { name: "query" });
    input.focus();

    fireEvent.keyDown(input, { key: "k", ctrlKey: true });

    expect(screen.getByTestId("global-search-dialog")).toHaveAttribute("data-open", "false");
  });

  it("路径匹配到导航项时应显示对应标题", () => {
    mockUsePathname.mockReturnValue("/data/table-1");

    render(<Header />);

    expect(screen.getByRole("heading", { level: 1, name: "主数据" })).toBeInTheDocument();
  });

  it("特殊路径应使用覆盖标题", () => {
    mockUsePathname.mockReturnValue("/templates/new");

    render(<Header />);

    expect(screen.getByRole("heading", { level: 1, name: "上传模板" })).toBeInTheDocument();
  });
});
