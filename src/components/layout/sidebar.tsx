"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  FileOutput,
  FileText,
  History,
  PenLine,
  ShieldCheck,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    title: "生成文档",
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

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="hidden md:flex h-screen w-60 flex-col border-r bg-zinc-950 shrink-0">
      {/* Logo / Brand */}
      <div className="flex h-14 items-center border-b border-zinc-800 px-4 shrink-0">
        <Link href="/" className="flex items-center gap-2.5 group">
          <ShieldCheck className="h-6 w-6 text-white transition-transform group-hover:scale-110" />
          <span className="text-base font-semibold text-white tracking-tight">
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
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
                )}
              >
                <span className={cn(
                  "transition-transform duration-200",
                  isActive && "scale-110"
                )}>
                  {item.icon}
                </span>
                {item.title}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-800 p-4 shrink-0">
        <p className="text-xs text-zinc-500 truncate">
          {session?.user?.name
            ? `已登录: ${session.user.name}`
            : "未登录"}
        </p>
      </div>
    </aside>
  );
}
