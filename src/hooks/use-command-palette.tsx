"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  LayoutGrid,
  Database,
  FileText,
  Upload,
  FilePenLine,
  Calculator,
  Zap,
  BookOpen,
  Bot,
} from "lucide-react";

export interface CommandItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onSelect: () => void;
  group: string;
  keywords?: string[];
}

const NAV_COMMANDS = [
  { id: "nav-templates", label: "模板库", href: "/templates", icon: LayoutGrid, shortcut: "⌘1", keywords: ["moban", "模板"] },
  { id: "nav-generate", label: "我要填表", href: "/generate", icon: Upload, keywords: ["tianbiao", "填表", "生成"] },
  { id: "nav-records", label: "生成记录", href: "/records", icon: FileText, shortcut: "⌘3", keywords: ["jilu", "记录"] },
  { id: "nav-drafts", label: "我的草稿", href: "/drafts", icon: FilePenLine, keywords: ["caogao", "草稿"] },
  { id: "nav-data", label: "数据表", href: "/data", icon: Database, shortcut: "⌘2", keywords: ["shuju", "数据"] },
  { id: "nav-reports", label: "撰写报告", href: "/reports/drafts", icon: BookOpen, keywords: ["baogao", "报告"] },
  { id: "nav-report-templates", label: "报告模板", href: "/reports/templates", icon: LayoutGrid, keywords: ["baogao", "报告", "模板"] },
  { id: "nav-budget", label: "预算报告", href: "/budget", icon: Calculator, keywords: ["yusuan", "预算"] },
  { id: "nav-automations", label: "自动化", href: "/automations", icon: Zap, keywords: ["zidonghua", "自动"] },
  { id: "nav-collections", label: "文档收集", href: "/collections", icon: FileText, shortcut: "⌘4", keywords: ["shouji", "收集"] },
  { id: "nav-ai", label: "智能助手", href: "/ai-agent2", icon: Bot, keywords: ["zhineng", "助手", "AI"] },
];

export function useCommands() {
  const router = useRouter();

  const commands = useMemo<CommandItem[]>(() => {
    const navItems: CommandItem[] = NAV_COMMANDS.map((cmd) => ({
      id: cmd.id,
      label: cmd.label,
      icon: <cmd.icon className="h-4 w-4" />,
      shortcut: cmd.shortcut,
      keywords: cmd.keywords,
      group: "导航",
      onSelect: () => router.push(cmd.href),
    }));

    return navItems;
  }, [router]);

  return commands;
}
