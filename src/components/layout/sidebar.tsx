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
} from "lucide-react";

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
    <aside className="hidden md:flex h-screen w-60 flex-col border-r bg-zinc-950">
      {/* Logo / Brand */}
      <div className="flex h-14 items-center border-b border-zinc-800 px-4">
        <Link href="/" className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-white" />
          <span className="text-lg font-semibold text-white">
            DOCX 模板系统
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
              }`}
            >
              {item.icon}
              {item.title}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-800 p-4">
        <p className="text-xs text-zinc-500">
          {session?.user?.name
            ? `已登录: ${session.user.name}`
            : "未登录"}
        </p>
      </div>
    </aside>
  );
}
