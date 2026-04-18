"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { GlobalSearchDialog } from "@/components/data/global-search-dialog";

const routeTitles: Record<string, string> = {
  "/": "仪表盘",
  "/templates": "模板管理",
  "/templates/new": "上传模板",
  "/records": "生成记录",
  "/drafts": "我的草稿",
  "/admin/users": "用户管理",
  "/admin/settings": "系统设置",
};

export function Header() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  const title = routeTitles[pathname] ?? "IDRL填表系统";

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen((v) => !v);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 sm:gap-4 border-b bg-background px-3 sm:px-6">
        {/* Mobile navigation */}
        <MobileNav />

        <div className="flex flex-1 items-center min-w-0">
          <h1 className="text-base sm:text-lg font-semibold truncate">{title}</h1>
        </div>

        <button
          onClick={() => setSearchOpen(true)}
          className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-md border bg-muted/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span>搜索...</span>
          <kbd className="rounded border bg-background px-1 py-0.5 text-[10px] font-mono">⌘K</kbd>
        </button>

        <ThemeToggle />
        <NotificationBell />
      </header>
      <GlobalSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
