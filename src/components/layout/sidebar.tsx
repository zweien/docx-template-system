"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Shield } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { AppLogo } from "@/components/layout/app-logo";
import { isRouteActive } from "@/components/layout/navigation/matcher";
import { ADMIN_NAV_ITEMS, FOOTER_NAV_ITEMS, NAV_ENTRIES, filterEntriesByRole, type NavItem } from "@/components/layout/navigation/schema";
import { NavGroup } from "@/components/layout/navigation/nav-group";
import { useNavigationState } from "@/components/layout/navigation/state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACTIVE_ITEM_CLASS_NAME =
  "border border-border-hover bg-accent/20 text-foreground shadow-[inset_0_0_0_1px_rgb(113_112_255_/_0.34)]";

const INACTIVE_ITEM_CLASS_NAME =
  "border border-transparent text-muted-foreground hover:border-border hover:bg-white/[0.03] hover:text-foreground";

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
        "flex items-center rounded-md text-sm font-[510] transition-[color,background-color,border-color,transform,opacity] duration-100",
        collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
        isActive ? ACTIVE_ITEM_CLASS_NAME : INACTIVE_ITEM_CLASS_NAME
      )}
    >
      <span className={cn("shrink-0 transition-transform duration-100", isActive && "scale-110")}>
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
  const [adminExpanded, setAdminExpanded] = useState(false);

  const filteredEntries = filterEntriesByRole(NAV_ENTRIES, role);
  const adminItems: readonly NavItem[] = ADMIN_NAV_ITEMS.filter((item: NavItem) => role === "ADMIN" || !item.roles?.length);
  const footerItems = FOOTER_NAV_ITEMS;

  // Split entries: home (0) | groups (1-3) | standalone tools (4-6)
  const homeEntry = filteredEntries.find((e) => e.type === "item" && e.item.id === "home");
  const groupEntries = filteredEntries.filter((e) => e.type === "group");
  const standaloneEntries = filteredEntries.filter(
    (e) => e.type === "item" && e.item.id !== "home"
  );

  return (
    <aside
      className={cn(
        "hidden h-screen shrink-0 flex-col border-r border-border-subtle bg-sidebar backdrop-blur-xl transition-[width] duration-100 md:flex",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-border-subtle px-4">
        <Link href="/" className="group flex items-center gap-2.5">
          <AppLogo className="transition-transform group-hover:scale-110" priority />
          <span
            className={cn(
              "whitespace-nowrap text-base font-[510] tracking-tight text-foreground transition-opacity duration-100",
              collapsed && "w-0 overflow-hidden opacity-0"
            )}
          >
            IDRL填表系统
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Home */}
        <div className="space-y-1.5">
          {homeEntry && homeEntry.type === "item" && (
            <SidebarNavLink key={homeEntry.item.id} item={homeEntry.item} pathname={pathname} collapsed={collapsed} />
          )}
        </div>

        {/* Navigation groups */}
        <div className="mt-4 border-t border-border-subtle pt-4 space-y-1.5">
          {groupEntries.map((entry) =>
            entry.type === "group" ? (
              <NavGroup key={entry.group.id} group={entry.group} collapsed={collapsed} />
            ) : null
          )}
        </div>

        {/* Standalone tools */}
        {standaloneEntries.length > 0 ? (
          <div className="mt-4 border-t border-border-subtle pt-4 space-y-1.5">
            {standaloneEntries.map((entry) =>
              entry.type === "item" ? (
                <SidebarNavLink key={entry.item.id} item={entry.item} pathname={pathname} collapsed={collapsed} />
              ) : null
            )}
          </div>
        ) : null}

        {/* Admin section */}
        {adminItems.length > 0 ? (
          <div className="mt-4 border-t border-border-subtle pt-4">
            {collapsed ? (
              <div className="space-y-1.5">
                {adminItems.map((item) => (
                  <SidebarNavLink key={item.id} item={item} pathname={pathname} collapsed={collapsed} />
                ))}
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => setAdminExpanded((prev) => !prev)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-[510] uppercase tracking-wider text-text-dim transition-colors hover:text-foreground"
                  aria-expanded={adminExpanded}
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">管理后台</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                      adminExpanded && "rotate-180"
                    )}
                  />
                </button>
                {adminExpanded && (
                  <div className="mt-0.5 space-y-1.5">
                    {adminItems.map((item) => (
                      <SidebarNavLink key={item.id} item={item} pathname={pathname} collapsed={collapsed} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </nav>

      <div className="shrink-0 px-3 py-2">
        <div className="text-xs text-text-dim">
          {!collapsed ? "IDRL填表系统 " : ""}v{process.env.NEXT_PUBLIC_APP_VERSION}
        </div>
        {footerItems.length > 0 && (
          <div className="mt-1 space-y-1">
            {footerItems.map((item) => (
              <SidebarNavLink key={item.id} item={item} pathname={pathname} collapsed={collapsed} />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border-subtle p-2">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
          className={cn(
            "text-muted-foreground hover:bg-white/5 hover:text-foreground",
            collapsed ? "mx-auto" : "w-full"
          )}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
