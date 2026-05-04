import type { ComponentType } from "react";
import { Bot, Calculator, Database, FilePenLine, FileText, FolderHeart, GitBranch, House, Info, LayoutGrid, Settings2, ShieldCheck, Users, WandSparkles } from "lucide-react";
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

// ---------------------------------------------------------------------------
// Grouped navigation types (Task 7)
// ---------------------------------------------------------------------------

export type NavGroupDef = {
  readonly id: string;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
  readonly section: NavSection;
  readonly order: number;
  readonly items: readonly NavItem[];
  readonly defaultExpanded?: boolean;
  readonly roles?: readonly Role[];
};

export type NavEntry =
  | { readonly type: "item"; readonly item: NavItem }
  | { readonly type: "group"; readonly group: NavGroupDef };

// ---------------------------------------------------------------------------
// Navigation group definitions
// ---------------------------------------------------------------------------

const TEMPLATE_FORM_GROUP: NavGroupDef = {
  id: "templates-forms",
  label: "模板与表单",
  icon: LayoutGrid,
  section: "main",
  order: 1,
  defaultExpanded: true,
  items: [
    { id: "templates", icon: LayoutGrid, href: "/templates", label: "模板库", section: "main", order: 1 },
    { id: "generate", icon: WandSparkles, href: "/generate", label: "我要填表", section: "main", order: 2 },
    { id: "records", icon: FileText, href: "/records", label: "生成记录", section: "main", order: 3 },
    { id: "drafts", icon: FilePenLine, href: "/drafts", label: "我的草稿", section: "main", order: 4 },
  ],
} as const satisfies NavGroupDef;

const DATA_GROUP: NavGroupDef = {
  id: "data",
  label: "数据中心",
  icon: Database,
  section: "main",
  order: 2,
  defaultExpanded: true,
  items: [
    { id: "data", icon: Database, href: "/data", label: "数据表", section: "main", order: 5 },
  ],
} as const satisfies NavGroupDef;

const REPORT_GROUP: NavGroupDef = {
  id: "reports",
  label: "报告中心",
  icon: FileText,
  section: "main",
  order: 3,
  defaultExpanded: true,
  items: [
    { id: "report-drafts", icon: FileText, href: "/reports/drafts", label: "撰写报告", section: "reports", order: 6 },
    { id: "report-templates", icon: LayoutGrid, href: "/reports/templates", label: "报告模板", section: "reports", order: 7 },
    { id: "budget", icon: Calculator, href: "/budget", label: "预算报告", section: "reports", order: 8 },
  ],
} as const satisfies NavGroupDef;

// ---------------------------------------------------------------------------
// Standalone items
// ---------------------------------------------------------------------------

const HOME_ITEM: NavItem = {
  id: "home",
  icon: House,
  href: "/",
  label: "首页",
  section: "main",
  order: 0,
} as const satisfies NavItem;

const AUTOMATIONS_ITEM: NavItem = {
  id: "automations",
  icon: GitBranch,
  href: "/automations",
  label: "自动化",
  section: "main",
  order: 9,
} as const satisfies NavItem;

const COLLECTIONS_ITEM: NavItem = {
  id: "collections",
  icon: FolderHeart,
  href: "/collections",
  label: "文档收集",
  section: "main",
  order: 10,
} as const satisfies NavItem;

const AI_AGENT_ITEM: NavItem = {
  id: "ai-agent2",
  icon: Bot,
  href: "/ai-agent2",
  label: "智能助手",
  section: "main",
  order: 11,
} as const satisfies NavItem;

// ---------------------------------------------------------------------------
// Admin items
// ---------------------------------------------------------------------------

export const ADMIN_NAV_ITEMS: readonly NavItem[] = [
  {
    id: "admin-settings",
    icon: Settings2,
    href: "/admin/settings",
    label: "系统设置",
    section: "admin",
    order: 0,
    roles: ["ADMIN"],
  },
  {
    id: "admin-editor-ai",
    icon: Bot,
    href: "/admin/editor-ai",
    label: "AI配置",
    section: "admin",
    order: 1,
    roles: ["ADMIN"],
  },
  {
    id: "admin-users",
    icon: Users,
    href: "/admin/users",
    label: "用户管理",
    section: "admin",
    order: 2,
    roles: ["ADMIN"],
  },
  {
    id: "admin-audit-logs",
    icon: ShieldCheck,
    href: "/admin/audit-logs",
    label: "审计日志",
    section: "admin",
    order: 3,
    roles: ["ADMIN"],
  },
] as const satisfies readonly NavItem[];

// ---------------------------------------------------------------------------
// Footer items
// ---------------------------------------------------------------------------

export const FOOTER_NAV_ITEMS: readonly NavItem[] = [
  { id: "about", icon: Info, href: "/about", label: "关于", section: "footer", order: 99 },
] as const satisfies readonly NavItem[];

// ---------------------------------------------------------------------------
// NAV_ENTRIES: ordered list of top-level NavEntry
// Structure: home -> template group -> data group -> report group -> automations -> collections -> ai-agent
// ---------------------------------------------------------------------------

export const NAV_ENTRIES: readonly NavEntry[] = [
  { type: "item", item: HOME_ITEM },
  { type: "group", group: TEMPLATE_FORM_GROUP },
  { type: "group", group: DATA_GROUP },
  { type: "group", group: REPORT_GROUP },
  { type: "item", item: AUTOMATIONS_ITEM },
  { type: "item", item: COLLECTIONS_ITEM },
  { type: "item", item: AI_AGENT_ITEM },
] as const satisfies readonly NavEntry[];

// ---------------------------------------------------------------------------
// Backward-compatible flat NAV_ITEMS
// ---------------------------------------------------------------------------

function flattenEntries(entries: readonly NavEntry[]): readonly NavItem[] {
  const items: NavItem[] = [];
  for (const entry of entries) {
    if (entry.type === "item") {
      items.push(entry.item);
    } else {
      items.push(...entry.group.items);
    }
  }
  return items as readonly NavItem[];
}

/**
 * Flat array of all navigation items, ordered by group/entry order.
 * Kept for backward compatibility (header, mobile-nav, etc.).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  ...flattenEntries(NAV_ENTRIES),
  ...ADMIN_NAV_ITEMS,
  ...FOOTER_NAV_ITEMS,
] as const satisfies readonly NavItem[];

// ---------------------------------------------------------------------------
// Role-based filtering
// ---------------------------------------------------------------------------

/**
 * 过滤导航项，并按 `order` 升序排序后返回只读结果。
 */
export function filterNavItemsByRole(items: readonly NavItem[], role?: Role): readonly NavItem[] {
  return [...items]
    .filter((item) => (role === undefined ? !item.roles : !item.roles || item.roles.includes(role)))
    .sort((a, b) => a.order - b.order) as readonly NavItem[];
}

/**
 * Filter NAV_ENTRIES by role, removing groups that have no visible items.
 */
export function filterEntriesByRole(entries: readonly NavEntry[], role?: Role): readonly NavEntry[] {
  return entries.filter((entry) => {
    if (entry.type === "item") {
      return role === undefined ? !entry.item.roles : !entry.item.roles || entry.item.roles.includes(role);
    }
    // group: check group-level roles and filter children
    const groupRoles = entry.group.roles;
    if (groupRoles && role && !groupRoles.includes(role)) {
      return false;
    }
    const visibleItems = entry.group.items.filter(
      (item) => (role === undefined ? !item.roles : !item.roles || item.roles.includes(role))
    );
    return visibleItems.length > 0;
  });
}
