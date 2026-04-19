import type { AnchorHTMLAttributes, ImgHTMLAttributes } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/generated/prisma/enums";
import { Sidebar } from "./sidebar";

const mockUsePathname = vi.fn();
const mockUseSession = vi.fn();
const mockUseNavigationState = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt ?? ""} />;
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

vi.mock("@/components/layout/navigation/state", () => ({
  useNavigationState: () => mockUseNavigationState(),
}));

vi.mock("@/components/layout/user-nav", () => ({
  UserNav: () => <div data-testid="user-nav">user-nav</div>,
}));

describe("Sidebar", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
    mockUseSession.mockReturnValue({ data: { user: { role: "USER" satisfies Role } } });
    mockUseNavigationState.mockReturnValue({
      collapsed: false,
      toggleCollapsed: vi.fn(),
    });
  });

  it("在数据详情页应将主数据标记为当前页面", () => {
    mockUsePathname.mockReturnValue("/data/abc");

    render(<Sidebar />);

    expect(screen.getByRole("link", { name: "主数据" })).toHaveAttribute("aria-current", "page");
  });

  it("USER 角色不显示系统设置", () => {
    render(<Sidebar />);

    expect(screen.queryByRole("link", { name: "系统设置" })).not.toBeInTheDocument();
  });

  it("ADMIN 角色显示系统设置", () => {
    mockUseSession.mockReturnValue({ data: { user: { role: "ADMIN" satisfies Role } } });

    render(<Sidebar />);

    expect(screen.getByRole("link", { name: "系统设置" })).toBeInTheDocument();
  });

  it("折叠按钮应调用共享导航状态的 toggleCollapsed", () => {
    const toggleCollapsed = vi.fn();
    mockUseNavigationState.mockReturnValue({
      collapsed: true,
      toggleCollapsed,
    });

    render(<Sidebar />);

    fireEvent.click(screen.getByRole("button", { name: "展开侧边栏" }));

    expect(toggleCollapsed).toHaveBeenCalledTimes(1);
  });
});
