import type { ComponentType } from "react";
import { Bot, Database, FilePenLine, FileText, FolderHeart, GitBranch, House, Info, LayoutGrid, Settings2, ShieldCheck, Users, WandSparkles } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";

export type NavSection = "main" | "reports" | "admin" | "footer";

export type NavItem = {
  readonly id: string;
  readonly icon: ComponentType<{ className?: string }>;
  readonly href: string;
  readonly label: string;
  readonly section: NavSection;
  readonly order: number;
  readonly roles?: readonly Role[];
};

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", icon: House, href: "/", label: "仪表盘", section: "main", order: 0 },
  { id: "generate", icon: WandSparkles, href: "/generate", label: "我要填表", section: "main", order: 1 },
  { id: "records", icon: FileText, href: "/records", label: "生成记录", section: "main", order: 2 },
  { id: "drafts", icon: FilePenLine, href: "/drafts", label: "我的草稿", section: "main", order: 3 },
  { id: "report-drafts", icon: FileText, href: "/reports/drafts", label: "撰写报告", section: "reports", order: 3.5 },
  { id: "report-templates", icon: LayoutGrid, href: "/reports/templates", label: "报告模板", section: "reports", order: 3.6 },
  { id: "templates", icon: LayoutGrid, href: "/templates", label: "模板管理", section: "main", order: 4 },
  { id: "data", icon: Database, href: "/data", label: "主数据", section: "main", order: 5 },
  { id: "automations", icon: GitBranch, href: "/automations", label: "自动化", section: "main", order: 5.5 },
  { id: "collections", icon: FolderHeart, href: "/collections", label: "文档收集", section: "main", order: 6 },
  { id: "ai-agent2", icon: Bot, href: "/ai-agent2", label: "智能助手", section: "main", order: 7 },
  {
    id: "admin-settings",
    icon: Settings2,
    href: "/admin/settings",
    label: "系统设置",
    section: "admin",
    order: 8,
    roles: ["ADMIN"],
  },
  {
    id: "admin-users",
    icon: Users,
    href: "/admin/users",
    label: "用户管理",
    section: "admin",
    order: 9,
    roles: ["ADMIN"],
  },
  {
    id: "admin-audit-logs",
    icon: ShieldCheck,
    href: "/admin/audit-logs",
    label: "审计日志",
    section: "admin",
    order: 10,
    roles: ["ADMIN"],
  },
  { id: "about", icon: Info, href: "/about", label: "关于", section: "footer", order: 99 },
] as const satisfies readonly NavItem[];

/**
 * 过滤导航项，并按 `order` 升序排序后返回只读结果。
 */
export function filterNavItemsByRole(items: readonly NavItem[], role?: Role): readonly NavItem[] {
  return [...items]
    .filter((item) => (role === undefined ? !item.roles : !item.roles || item.roles.includes(role)))
    .sort((a, b) => a.order - b.order) as readonly NavItem[];
}
