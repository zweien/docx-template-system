"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { isRouteActive } from "@/components/layout/navigation/matcher";
import { NAV_ITEMS } from "@/components/layout/navigation/schema";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { GlobalSearchDialog } from "@/components/data/global-search-dialog";

const routeTitleOverrides: Record<string, string> = {
  "/ai-agent2": "智能助手",
  "/templates/new": "上传模板",
};

function getHeaderTitle(pathname: string): string {
  const overrideTitle = routeTitleOverrides[pathname];
  if (overrideTitle) {
    return overrideTitle;
  }

  const matched = NAV_ITEMS.find((item) => isRouteActive(item.href, pathname));
  return matched?.label ?? "IDRL填表系统";
}

function isTypingElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

export function Header() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  const title = getHeaderTitle(pathname);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isTypingElement(e.target)) {
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
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
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-[rgb(255_255_255_/_0.05)] bg-[rgb(15_16_17_/_0.92)] px-3 backdrop-blur-xl sm:gap-4 sm:px-6">
        <MobileNav />

        <div className="flex flex-1 items-center min-w-0">
          <h1 className="truncate text-base font-[510] tracking-[-0.13px] sm:text-lg">{title}</h1>
        </div>

        <button
          onClick={() => setSearchOpen(true)}
          className="hidden h-8 items-center gap-2 rounded-md border border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.02)] px-3 text-sm font-[510] text-muted-foreground transition-all hover:border-[rgb(255_255_255_/_0.15)] hover:bg-[rgb(255_255_255_/_0.05)] hover:text-foreground sm:flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span>搜索...</span>
          <kbd className="rounded border border-[rgb(255_255_255_/_0.08)] bg-[rgb(0_0_0_/_0.3)] px-1 py-0.5 font-mono text-[10px] text-[#d0d6e0]">
            ⌘K
          </kbd>
        </button>

        <ThemeToggle />
        <NotificationBell />
      </header>
      <GlobalSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
