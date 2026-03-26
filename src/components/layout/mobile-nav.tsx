"use client";

import { useState } from "react";
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
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    title: "生成文档",
    href: "/generate",
    icon: <FileOutput className="h-5 w-5" />,
  },
  {
    title: "模板管理",
    href: "/templates",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    title: "主数据",
    href: "/data",
    icon: <Database className="h-5 w-5" />,
  },
  {
    title: "生成记录",
    href: "/records",
    icon: <History className="h-5 w-5" />,
  },
  {
    title: "我的草稿",
    href: "/drafts",
    icon: <PenLine className="h-5 w-5" />,
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9 hover:bg-muted"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">打开菜单</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">DOCX 模板系统</span>
          </SheetTitle>
        </SheetHeader>

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
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
        <div className="border-t px-4 py-4 shrink-0">
          <p className="text-sm text-muted-foreground">
            {session?.user?.name
              ? `已登录: ${session.user.name}`
              : "未登录"}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
