import type { AnchorHTMLAttributes, ImgHTMLAttributes, MouseEventHandler, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/generated/prisma/enums";
import { MobileNav } from "./mobile-nav";

const mockUsePathname = vi.fn();
const mockUseSession = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onNavigate,
    ...props
    }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children?: ReactNode;
    onNavigate?: (event: { preventDefault: () => void }) => void;
  }) => {
    const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey) {
        event.preventDefault();
        return;
      }

      let navigationPrevented = false;
      onNavigate?.({
        preventDefault: () => {
          navigationPrevented = true;
        },
      });

      event.preventDefault();

      if (navigationPrevented) {
        return;
      }
    };

    return (
      <a
        href={href}
        onClick={handleClick}
        {...props}
      >
        {children}
      </a>
    );
  },
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

describe("MobileNav", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
    mockUseSession.mockReturnValue({ data: { user: { role: "USER" satisfies Role, name: "测试用户" } } });
  });

  function openMenu() {
    const trigger = screen.getByRole("button", { name: "打开菜单" });
    fireEvent.click(trigger);
    return trigger;
  }

  function getLinkByHref(href: string) {
    const link = document.querySelector<HTMLAnchorElement>(`a[href="${href}"]`);

    expect(link).not.toBeNull();
    return link as HTMLAnchorElement;
  }

  it("点击菜单触发器后应显示导航项", () => {
    render(<MobileNav />);

    const trigger = openMenu();

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(getLinkByHref("/data")).toBeInTheDocument();
  });

  it("点击未被阻止的导航项后应关闭抽屉", () => {
    render(<MobileNav />);

    const trigger = openMenu();
    fireEvent.click(getLinkByHref("/data"));

    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("Ctrl 点击导航项时不应关闭抽屉", () => {
    render(<MobileNav />);

    const trigger = openMenu();

    fireEvent.click(getLinkByHref("/data"), { ctrlKey: true });

    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("当前路径命中的导航项应带有 aria-current", () => {
    mockUsePathname.mockReturnValue("/data/table-1");

    render(<MobileNav />);

    openMenu();

    expect(screen.getByRole("link", { current: "page" })).toHaveAttribute("href", "/data");
  });

  it("USER 不显示系统设置", () => {
    render(<MobileNav />);

    openMenu();

    expect(document.querySelector(`a[href="/admin/settings"]`)).toBeNull();
  });

  it("ADMIN 显示系统设置", () => {
    mockUseSession.mockReturnValue({ data: { user: { role: "ADMIN" satisfies Role, name: "管理员" } } });

    render(<MobileNav />);

    openMenu();

    expect(getLinkByHref("/admin/settings")).toBeInTheDocument();
  });

  it("未登录时 footer 显示未登录", () => {
    mockUseSession.mockReturnValue({ data: null });

    render(<MobileNav />);

    openMenu();

    expect(screen.getByText("未登录")).toBeInTheDocument();
  });
});
