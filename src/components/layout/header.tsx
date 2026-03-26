"use client";

import { usePathname } from "next/navigation";
import { UserNav } from "@/components/layout/user-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Separator } from "@/components/ui/separator";

const routeTitles: Record<string, string> = {
  "/": "仪表盘",
  "/templates": "模板管理",
  "/templates/new": "上传模板",
  "/records": "生成记录",
  "/drafts": "我的草稿",
};

export function Header() {
  const pathname = usePathname();

  const title = routeTitles[pathname] ?? "DOCX 模板系统";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 sm:gap-4 border-b bg-background px-3 sm:px-6">
      {/* Mobile navigation */}
      <MobileNav />

      <div className="flex flex-1 items-center min-w-0">
        <h1 className="text-base sm:text-lg font-semibold truncate">{title}</h1>
      </div>
      <Separator orientation="vertical" className="h-6 hidden sm:block" />
      <UserNav />
    </header>
  );
}
