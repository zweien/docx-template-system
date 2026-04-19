"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { UserNav } from "@/components/layout/user-nav";
import { isRouteActive } from "@/components/layout/navigation/matcher";
import { NAV_ITEMS, filterNavItemsByRole, type NavItem } from "@/components/layout/navigation/schema";
import { useNavigationState } from "@/components/layout/navigation/state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACTIVE_ITEM_CLASS_NAME =
  "border border-[rgb(255_255_255_/_0.1)] bg-[rgb(113_112_255_/_0.18)] text-[#f7f8f8] shadow-[inset_0_0_0_1px_rgb(113_112_255_/_0.34)]";

const INACTIVE_ITEM_CLASS_NAME =
  "text-[#8a8f98] hover:border hover:border-[rgb(255_255_255_/_0.08)] hover:bg-[rgb(255_255_255_/_0.03)] hover:text-[#f7f8f8]";

type SidebarNavLinkProps = {
  readonly collapsed: boolean;
  readonly item: NavItem;
  readonly pathname: string;
};

function SidebarNavLink({ collapsed, item, pathname }: SidebarNavLinkProps) {
  const isActive = isRouteActive(item.href, pathname);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center rounded-md text-sm font-[510] transition-all duration-200",
        collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
        isActive ? ACTIVE_ITEM_CLASS_NAME : INACTIVE_ITEM_CLASS_NAME
      )}
    >
      <span className={cn("shrink-0 transition-transform duration-200", isActive && "scale-110")}>
        <Icon className="h-4 w-4" />
      </span>
      <span
        className={cn(
          "whitespace-nowrap transition-opacity duration-200",
          collapsed && "w-0 overflow-hidden opacity-0"
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { collapsed, toggleCollapsed } = useNavigationState();
  const role = session?.user?.role as Role | undefined;
  const navItems = filterNavItemsByRole(NAV_ITEMS, role);
  const mainItems = navItems.filter((item) => item.section === "main");
  const adminItems = navItems.filter((item) => item.section === "admin");

  return (
    <aside
      className={cn(
        "hidden h-screen shrink-0 flex-col border-r border-[rgb(255_255_255_/_0.05)] bg-[rgb(15_16_17_/_0.92)] backdrop-blur-xl transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-[rgb(255_255_255_/_0.05)] px-4">
        <Link href="/" className="group flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="IDRL填表系统"
            width={28}
            height={28}
            className="shrink-0 transition-transform group-hover:scale-110"
          />
          <span
            className={cn(
              "whitespace-nowrap text-base font-[510] tracking-[-0.13px] text-[#f7f8f8] transition-opacity duration-200",
              collapsed && "w-0 overflow-hidden opacity-0"
            )}
          >
            IDRL填表系统
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1.5">
          {mainItems.map((item) => (
            <SidebarNavLink key={item.id} item={item} pathname={pathname} collapsed={collapsed} />
          ))}
        </div>

        {adminItems.length > 0 ? (
          <div className="mt-6 border-t border-[rgb(255_255_255_/_0.05)] pt-4">
            {!collapsed ? (
              <p className="mb-2 px-3 text-xs font-[510] uppercase tracking-wider text-[#62666d]">
                管理员
              </p>
            ) : null}
            <div className="space-y-1.5">
              {adminItems.map((item) => (
                <SidebarNavLink key={item.id} item={item} pathname={pathname} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ) : null}
      </nav>

      <div className="shrink-0 px-3 py-2 text-xs text-[#62666d]">
        {!collapsed ? "IDRL填表系统 " : ""}v{process.env.NEXT_PUBLIC_APP_VERSION}
      </div>

      <div className="shrink-0 border-t border-[rgb(255_255_255_/_0.05)]">
        <div className="flex items-center gap-2 p-2">
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <UserNav />
            </div>
          ) : null}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
            className={cn(
              "shrink-0 text-[#8a8f98] hover:bg-white/5 hover:text-[#f7f8f8]",
              collapsed && "mx-auto"
            )}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </aside>
  );
}
