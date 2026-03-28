"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  FileOutput,
  FileText,
  History,
  PenLine,
  ShieldCheck,
  Database,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserNav } from "@/components/layout/user-nav";
import { Button } from "@/components/ui/button";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    title: "仪表盘",
    href: "/",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    title: "我要填表",
    href: "/generate",
    icon: <FileOutput className="h-4 w-4" />,
  },
  {
    title: "模板管理",
    href: "/templates",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    title: "主数据",
    href: "/data",
    icon: <Database className="h-4 w-4" />,
  },
  {
    title: "生成记录",
    href: "/records",
    icon: <History className="h-4 w-4" />,
  },
  {
    title: "我的草稿",
    href: "/drafts",
    icon: <PenLine className="h-4 w-4" />,
  },
];

const adminNavItems: NavItem[] = [
  {
    title: "用户管理",
    href: "/admin/users",
    icon: <Users className="h-4 w-4" />,
  },
];

const STORAGE_KEY = "sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setCollapsed(stored === "true");
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return (
    <aside
      className={cn(
        "hidden md:flex h-screen flex-col border-r bg-zinc-950 shrink-0 transition-[width] duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo / Brand */}
      <div className="flex h-14 items-center border-b border-zinc-800 px-4 shrink-0">
        <Link href="/" className="flex items-center gap-2.5 group">
          <ShieldCheck className="h-6 w-6 text-white shrink-0 transition-transform group-hover:scale-110" />
          <span
            className={cn(
              "text-base font-semibold text-white tracking-tight whitespace-nowrap transition-opacity duration-200",
              collapsed && "opacity-0 w-0 overflow-hidden"
            )}
          >
            DOCX 模板系统
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.title : undefined}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                  collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
                )}
              >
                <span className={cn(
                  "shrink-0 transition-transform duration-200",
                  isActive && "scale-110"
                )}>
                  {item.icon}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap transition-opacity duration-200",
                    collapsed && "opacity-0 w-0 overflow-hidden"
                  )}
                >
                  {item.title}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Admin Section */}
        {session?.user?.role === "ADMIN" && (
          <div className="mt-6 pt-4 border-t border-zinc-800">
            {!collapsed && (
              <p className="px-3 mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                管理员
              </p>
            )}
            <div className="space-y-1">
              {adminNavItems.map((item) => {
                const isActive = pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.title : undefined}
                    className={cn(
                      "flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                      collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
                      isActive
                        ? "bg-white text-zinc-950 shadow-sm"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
                    )}
                  >
                    <span className={cn(
                      "shrink-0 transition-transform duration-200",
                      isActive && "scale-110"
                    )}>
                      {item.icon}
                    </span>
                    <span
                      className={cn(
                        "whitespace-nowrap transition-opacity duration-200",
                        collapsed && "opacity-0 w-0 overflow-hidden"
                      )}
                    >
                      {item.title}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Footer: collapse button + user nav */}
      <div className="border-t border-zinc-800 shrink-0">
        <div className="flex items-center gap-2 p-2">
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <UserNav />
            </div>
          )}
          {collapsed && (
            <div className="w-full flex justify-center">
              <UserNav />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={toggle}
            className="shrink-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </aside>
  );
}
