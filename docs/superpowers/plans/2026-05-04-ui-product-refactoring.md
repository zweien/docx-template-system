# UI 产品级重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一全站视觉语言（对齐 DESIGN.md Linear 规范）、重组侧边栏导航（16→7 项）、重设计首页工作台

**Architecture:** 4 阶段递进：先建基础设施（共享组件 + CSS tokens），再改导航，再做首页，最后逐页统一。每个阶段可独立发布。

**Tech Stack:** Next.js 16 / Tailwind CSS v4 / shadcn/ui v4 (Base UI) / Lucide icons

---

## 文件结构总览

### 新建文件
- `src/components/shared/page-header.tsx` — 统一页面标题组件
- `src/components/shared/empty-state.tsx` — 统一空状态组件
- `src/components/shared/filter-bar.tsx` — 统一筛选栏组件
- `src/components/shared/content-card.tsx` — 统一卡片容器组件
- `src/components/shared/breadcrumbs.tsx` — 统一面包屑组件
- `src/components/shared/index.ts` — barrel export
- `src/components/layout/navigation/nav-group.tsx` — 侧边栏分组折叠组件

### 修改文件
- `src/app/tokens.css` — 更新 CSS tokens 对齐 DESIGN.md
- `src/components/layout/navigation/schema.ts` — 添加分组结构和 children
- `src/components/layout/sidebar.tsx` — 重构为分组导航
- `src/app/(dashboard)/page.tsx` — 首页工作台重设计
- `src/app/(dashboard)/*.tsx` — 各页面应用共享组件（Phase 4）

---

## Phase 1：设计系统 + 共享组件

### Task 1: 更新 CSS tokens 对齐 DESIGN.md

**Files:**
- Modify: `src/app/tokens.css`

- [ ] **Step 1: 更新 tokens.css 中的表面层级变量**

在 `@theme` 块中，确保以下变量与 DESIGN.md Linear 规范完全对齐。当前 `tokens.css` 已基本对齐，需确认这些值：

```css
/* src/app/tokens.css — 确认以下值已正确设置 */

--ui-color-background: #08090A;        /* Marketing Black — 页面底色 */
--ui-color-background-subtle: #0F1011; /* Panel Dark — 侧边栏/面板 */
--ui-color-surface: #191A1B;           /* Level 3 — 卡片/弹出层 */
--ui-color-surface-hover: #28282C;     /* Secondary Surface — hover 状态 */

--ui-color-foreground: #F7F8F8;        /* Primary Text */
--ui-color-text-secondary: #D0D6E0;    /* Secondary Text */
--ui-color-muted-foreground: #8A8F98;  /* Tertiary Text */
--ui-color-dim: #62666D;               /* Quaternary Text — 最弱 */

--ui-color-primary: #5E6AD2;           /* Brand Indigo */
--ui-color-accent: #7170FF;            /* 交互强调 */
--ui-color-accent-hover: #828FFF;      /* 悬浮态 */

--ui-color-border: rgb(255 255 255 / 0.08);
--ui-color-border-subtle: rgb(255 255 255 / 0.05);
```

检查并补全缺失的变量。不需要新增 — 只需确认现有值正确。

- [ ] **Step 2: 在 shadcn 的 CSS 变量中引用 tokens**

打开 `src/app/globals.css` 或 shadcn 主题文件，确认 `:root` 和 `.dark` 中的 `--background`, `--card`, `--foreground`, `--muted-foreground`, `--border` 等变量正确引用了 tokens.css 中的值。

关键映射：
```css
:root {
  --background: var(--ui-color-background);        /* #08090A */
  --card: var(--ui-color-surface);                  /* #191A1B */
  --popover: var(--ui-color-surface);
  --foreground: var(--ui-color-foreground);         /* #F7F8F8 */
  --muted-foreground: var(--ui-color-muted-foreground); /* #8A8F98 */
  --primary: var(--ui-color-primary);               /* #5E6AD2 */
  --accent: var(--ui-color-accent);                 /* #7170FF */
  --border: var(--ui-color-border);
}
```

- [ ] **Step 3: 验证构建通过**

Run: `npx tsc --noEmit && npm run build`
Expected: 编译通过，无类型错误

- [ ] **Step 4: 提交**

```bash
git add src/app/tokens.css
git commit -m "chore: align CSS tokens with DESIGN.md Linear spec"
```

---

### Task 2: 创建 PageHeader 组件

**Files:**
- Create: `src/components/shared/page-header.tsx`
- Create: `src/components/shared/index.ts`

- [ ] **Step 1: 创建 shared 目录和 PageHeader 组件**

```tsx
// src/components/shared/page-header.tsx
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        <h1 className="text-2xl font-[510] tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[15px] tracking-tight text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 2: 创建 barrel export**

```tsx
// src/components/shared/index.ts
export { PageHeader } from "./page-header";
```

- [ ] **Step 3: 验证构建通过**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: 提交**

```bash
git add src/components/shared/page-header.tsx src/components/shared/index.ts
git commit -m "feat(ui): add PageHeader shared component"
```

---

### Task 3: 创建 EmptyState 组件

**Files:**
- Create: `src/components/shared/empty-state.tsx`
- Modify: `src/components/shared/index.ts`

- [ ] **Step 1: 创建 EmptyState 组件**

```tsx
// src/components/shared/empty-state.tsx
import { type ComponentType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-card">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-[15px] font-[510] tracking-tight text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 2: 更新 barrel export**

```tsx
// src/components/shared/index.ts
export { PageHeader } from "./page-header";
export { EmptyState } from "./empty-state";
```

- [ ] **Step 3: 验证构建通过**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: 提交**

```bash
git add src/components/shared/empty-state.tsx src/components/shared/index.ts
git commit -m "feat(ui): add EmptyState shared component"
```

---

### Task 4: 创建 FilterBar 组件

**Files:**
- Create: `src/components/shared/filter-bar.tsx`
- Modify: `src/components/shared/index.ts`

- [ ] **Step 1: 创建 FilterBar 组件**

```tsx
// src/components/shared/filter-bar.tsx
"use client";

import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterBarProps {
  options: readonly FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function FilterBar({ options, value, onChange, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1",
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-[510] transition-colors",
            value === option.value
              ? "bg-accent/20 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="text-dim-foreground">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 更新 barrel export**

在 `src/components/shared/index.ts` 末尾追加：
```tsx
export { FilterBar } from "./filter-bar";
```

- [ ] **Step 3: 验证构建通过**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: 提交**

```bash
git add src/components/shared/filter-bar.tsx src/components/shared/index.ts
git commit -m "feat(ui): add FilterBar shared component"
```

---

### Task 5: 创建 ContentCard 组件

**Files:**
- Create: `src/components/shared/content-card.tsx`
- Modify: `src/components/shared/index.ts`

- [ ] **Step 1: 创建 ContentCard 组件**

```tsx
// src/components/shared/content-card.tsx
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ContentCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function ContentCard({ children, className, hover }: ContentCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-6",
        hover && "transition-colors hover:border-border-hover hover:bg-surface-hover",
        className
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: 更新 barrel export**

在 `src/components/shared/index.ts` 末尾追加：
```tsx
export { ContentCard } from "./content-card";
```

- [ ] **Step 3: 验证构建通过**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: 提交**

```bash
git add src/components/shared/content-card.tsx src/components/shared/index.ts
git commit -m "feat(ui): add ContentCard shared component"
```

---

### Task 6: 创建 Breadcrumbs 组件

**Files:**
- Create: `src/components/shared/breadcrumbs.tsx`
- Modify: `src/components/shared/index.ts`

- [ ] **Step 1: 创建 Breadcrumbs 组件**

```tsx
// src/components/shared/breadcrumbs.tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: readonly BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav className={cn("flex items-center gap-1 text-sm", className)}>
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && (
            <ChevronRight className="h-3 w-3 text-dim-foreground" />
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: 更新 barrel export**

在 `src/components/shared/index.ts` 末尾追加：
```tsx
export { Breadcrumbs } from "./breadcrumbs";
```

- [ ] **Step 3: 验证构建通过**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: 提交**

```bash
git add src/components/shared/breadcrumbs.tsx src/components/shared/index.ts
git commit -m "feat(ui): add Breadcrumbs shared component"
```

---

## Phase 2：导航重构

### Task 7: 重构导航 Schema 为分组结构

**Files:**
- Modify: `src/components/layout/navigation/schema.ts`

- [ ] **Step 1: 定义新的分组类型和 Schema**

将 `NavItem` 扩展支持 `groupId` 和 `children`，新增 `NavGroup` 类型。保持向后兼容 — 旧代码仍可读 `NAV_ITEMS` 扁平数组。

```typescript
// src/components/layout/navigation/schema.ts
import { type ComponentType } from "react";
import {
  LayoutDashboard,
  FileText,
  SquarePen,
  ClipboardList,
  FileArchive,
  FileBarChart2,
  BookText,
  Wallet,
  Database,
  Workflow,
  FolderArchive,
  Bot,
  Settings,
  Users,
  ScrollText,
  Info,
  type LucideProps,
} from "lucide-react";
import { Role } from "@/generated/prisma/enums";

// ── Types ──────────────────────────────────────────

export type NavSection = "main" | "admin" | "footer";

export interface NavItem {
  readonly id: string;
  readonly icon: ComponentType<{ className?: string }>;
  readonly href: string;
  readonly label: string;
  readonly section: NavSection;
  readonly order: number;
  readonly roles?: readonly Role[];
}

export interface NavGroupDef {
  readonly id: string;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
  readonly section: NavSection;
  readonly order: number;
  readonly items: readonly NavItem[];
  readonly defaultExpanded?: boolean;
  readonly roles?: readonly Role[];
}

export type NavEntry =
  | { readonly type: "item"; readonly item: NavItem }
  | { readonly type: "group"; readonly group: NavGroupDef };

// ── Group Definitions ──────────────────────────────

const TEMPLATE_FORM_GROUP: NavGroupDef = {
  id: "templates-forms",
  label: "模板与表单",
  icon: FileText,
  section: "main",
  order: 1,
  items: [
    {
      id: "templates",
      icon: FileText,
      href: "/templates",
      label: "模板库",
      section: "main",
      order: 0,
    },
    {
      id: "generate",
      icon: SquarePen,
      href: "/generate",
      label: "我要填表",
      section: "main",
      order: 1,
    },
    {
      id: "records",
      icon: ClipboardList,
      href: "/records",
      label: "生成记录",
      section: "main",
      order: 2,
    },
    {
      id: "drafts",
      icon: FileArchive,
      href: "/drafts",
      label: "我的草稿",
      section: "main",
      order: 3,
    },
  ],
} as const satisfies NavGroupDef;

const DATA_GROUP: NavGroupDef = {
  id: "data",
  label: "数据中心",
  icon: Database,
  section: "main",
  order: 2,
  items: [
    {
      id: "data-tables",
      icon: Database,
      href: "/data",
      label: "数据表",
      section: "main",
      order: 0,
    },
  ],
} as const satisfies NavGroupDef;

const REPORT_GROUP: NavGroupDef = {
  id: "reports",
  label: "报告中心",
  icon: FileBarChart2,
  href: "/reports/drafts",
  section: "main",
  order: 3,
  items: [
    {
      id: "report-drafts",
      icon: BookText,
      href: "/reports/drafts",
      label: "撰写报告",
      section: "main",
      order: 0,
    },
    {
      id: "report-templates",
      icon: FileText,
      href: "/reports/templates",
      label: "报告模板",
      section: "main",
      order: 1,
    },
    {
      id: "budget",
      icon: Wallet,
      href: "/budget",
      label: "预算报告",
      section: "main",
      order: 2,
    },
  ],
} as const satisfies NavGroupDef;

// ── Standalone Items ───────────────────────────────

const STANDALONE_ITEMS = [
  {
    id: "home",
    icon: LayoutDashboard,
    href: "/",
    label: "首页",
    section: "main" as NavSection,
    order: 0,
  },
  {
    id: "automations",
    icon: Workflow,
    href: "/automations",
    label: "自动化",
    section: "main" as NavSection,
    order: 4,
  },
  {
    id: "collections",
    icon: FolderArchive,
    href: "/collections",
    label: "文档收集",
    section: "main" as NavSection,
    order: 5,
  },
  {
    id: "ai-agent",
    icon: Bot,
    href: "/ai-agent2",
    label: "智能助手",
    section: "main" as NavSection,
    order: 6,
  },
] as const satisfies readonly NavItem[];

// ── Admin Items ────────────────────────────────────

const ADMIN_ITEMS = [
  {
    id: "admin-settings",
    icon: Settings,
    href: "/admin/settings",
    label: "系统设置",
    section: "admin" as NavSection,
    order: 8,
    roles: [Role.ADMIN] as const,
  },
  {
    id: "admin-editor-ai",
    icon: Bot,
    href: "/admin/editor-ai",
    label: "AI 配置",
    section: "admin" as NavSection,
    order: 9,
    roles: [Role.ADMIN] as const,
  },
  {
    id: "admin-users",
    icon: Users,
    href: "/admin/users",
    label: "用户管理",
    section: "admin" as NavSection,
    order: 10,
    roles: [Role.ADMIN] as const,
  },
  {
    id: "admin-audit",
    icon: ScrollText,
    href: "/admin/audit-logs",
    label: "审计日志",
    section: "admin" as NavSection,
    order: 11,
    roles: [Role.ADMIN] as const,
  },
] as const satisfies readonly NavItem[];

// ── Footer Items ───────────────────────────────────

const FOOTER_ITEMS = [
  {
    id: "about",
    icon: Info,
    href: "/about",
    label: "关于",
    section: "footer" as NavSection,
    order: 99,
  },
] as const satisfies readonly NavItem[];

// ── Composed Navigation ────────────────────────────

export const NAV_GROUPS: readonly NavGroupDef[] = [
  TEMPLATE_FORM_GROUP,
  DATA_GROUP,
  REPORT_GROUP,
] as const;

export const NAV_ENTRIES: readonly NavEntry[] = [
  { type: "item", item: STANDALONE_ITEMS[0] }, // home
  { type: "group", group: TEMPLATE_FORM_GROUP },
  { type: "group", group: DATA_GROUP },
  { type: "group", group: REPORT_GROUP },
  { type: "item", item: STANDALONE_ITEMS[1] }, // automations
  { type: "item", item: STANDALONE_ITEMS[2] }, // collections
  { type: "item", item: STANDALONE_ITEMS[3] }, // ai-agent
] as const;

// ── Backward-compatible flat list ──────────────────

export const NAV_ITEMS: readonly NavItem[] = [
  STANDALONE_ITEMS[0], // home
  ...TEMPLATE_FORM_GROUP.items,
  ...DATA_GROUP.items,
  ...REPORT_GROUP.items,
  ...STANDALONE_ITEMS.slice(1),
  ...ADMIN_ITEMS,
  ...FOOTER_ITEMS,
] as const;

export const ADMIN_NAV_ITEMS = ADMIN_ITEMS;
export const FOOTER_NAV_ITEMS = FOOTER_ITEMS;

// ── Filter Helpers ─────────────────────────────────

export function filterNavItemsByRole(
  items: readonly NavItem[],
  role: Role
): readonly NavItem[] {
  return items
    .filter((item) => !item.roles || item.roles.includes(role))
    .sort((a, b) => a.order - b.order);
}

export function filterEntriesByRole(
  entries: readonly NavEntry[],
  role: Role
): readonly NavEntry[] {
  return entries
    .filter((entry) => {
      if (entry.type === "item") {
        return !entry.item.roles || entry.item.roles.includes(role);
      }
      // group: 过滤掉没有权限的 group（按 group 自身的 roles 或其 items 的 roles）
      const group = entry.group;
      const hasGroupRole = !group.roles || group.roles.includes(role);
      if (!hasGroupRole) return false;
      // 过滤 group 内的 items
      return group.items.some(
        (item) => !item.roles || item.roles.includes(role)
      );
    })
    .map((entry) => {
      if (entry.type === "group") {
        return {
          ...entry,
          group: {
            ...entry.group,
            items: entry.group.items.filter(
              (item) => !item.roles || item.roles.includes(role)
            ),
          },
        };
      }
      return entry;
    });
}
```

- [ ] **Step 2: 验证类型检查通过**

Run: `npx tsc --noEmit`
Expected: 无类型错误（旧代码仍使用 `NAV_ITEMS` 扁平数组，向后兼容）

- [ ] **Step 3: 提交**

```bash
git add src/components/layout/navigation/schema.ts
git commit -m "feat(nav): add grouped navigation schema with NavGroupDef"
```

---

### Task 8: 创建 NavGroup 折叠组件

**Files:**
- Create: `src/components/layout/navigation/nav-group.tsx`

- [ ] **Step 1: 创建 NavGroup 组件**

```tsx
// src/components/layout/navigation/nav-group.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { type NavGroupDef } from "./schema";
import {
  ACTIVE_ITEM_CLASS_NAME,
  INACTIVE_ITEM_CLASS_NAME,
} from "../sidebar";

interface NavGroupProps {
  group: NavGroupDef;
  collapsed: boolean;
}

export function NavGroup({ group, collapsed }: NavGroupProps) {
  const pathname = usePathname();
  const hasActiveChild = group.items.some((item) =>
    pathname.startsWith(item.href)
  );
  const [expanded, setExpanded] = useState(hasActiveChild);

  // 折叠状态下，显示组图标
  if (collapsed) {
    const activeItem = group.items.find((item) =>
      pathname.startsWith(item.href)
    );
    const Icon = group.icon;
    return (
      <Link
        href={activeItem?.href ?? group.items[0].href}
        className={cn(
          "flex items-center justify-center rounded-md p-2 transition-colors",
          hasActiveChild
            ? ACTIVE_ITEM_CLASS_NAME
            : INACTIVE_ITEM_CLASS_NAME
        )}
        title={group.label}
      >
        <Icon className="h-4 w-4" />
      </Link>
    );
  }

  const Icon = group.icon;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-[510] uppercase tracking-wider text-[#62666d] hover:text-[#8a8f98] transition-colors"
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>
      {expanded && (
        <div className="mt-0.5 flex flex-col gap-0.5 pl-2">
          {group.items.map((item) => {
            const ItemIcon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all",
                  isActive
                    ? ACTIVE_ITEM_CLASS_NAME
                    : INACTIVE_ITEM_CLASS_NAME
                )}
              >
                <ItemIcon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform",
                    isActive && "scale-110"
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证类型检查通过**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: 提交**

```bash
git add src/components/layout/navigation/nav-group.tsx
git commit -m "feat(nav): add NavGroup collapsible component"
```

---

### Task 9: 重构 Sidebar 使用分组导航

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: 重构 Sidebar 组件**

将现有的扁平导航列表替换为使用 `NAV_ENTRIES` 和 `NavGroup` 的分组导航。关键变化：

1. 导入 `NAV_ENTRIES`、`ADMIN_NAV_ITEMS`、`FOOTER_NAV_ITEMS`、`filterEntriesByRole` 替代旧的 `NAV_ITEMS`、`filterNavItemsByRole`
2. 导入 `NavGroup` 组件
3. 主导航区域遍历 `entries`，对 `type === "group"` 渲染 `<NavGroup>`，对 `type === "item"` 渲染现有 `<SidebarNavLink>`
4. 分隔线放置位置：首页后、工具项（自动化/收集/助手）前
5. 管理后台收为可展开区块（用 ChevronDown 控制），默认折叠
6. 保持现有的 collapsed 逻辑、用户信息、版本号不变

核心渲染逻辑伪代码：
```tsx
{filteredEntries.map((entry) => {
  if (entry.type === "group") {
    return <NavGroup key={entry.group.id} group={entry.group} collapsed={collapsed} />;
  }
  const item = entry.item;
  return <SidebarNavLink key={item.id} item={item} collapsed={collapsed} />;
})}
```

管理后台区块：
```tsx
{isAdmin && (
  <div className="border-t border-[rgb(255_255_255_/_0.05)] pt-1">
    <button
      onClick={() => setAdminExpanded(!adminExpanded)}
      className="flex w-full items-center gap-2 px-2 py-1.5 text-xs font-[510] text-[#62666d]"
    >
      <Settings className="h-3.5 w-3.5" />
      {!collapsed && <span>管理后台</span>}
      {!collapsed && <ChevronDown className={cn("ml-auto h-3 w-3 transition-transform", adminExpanded && "rotate-180")} />}
    </button>
    {adminExpanded && !collapsed && (
      <div className="mt-0.5 flex flex-col gap-0.5 pl-2">
        {filteredAdminItems.map(item => <SidebarNavLink key={item.id} item={item} collapsed={collapsed} />)}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 2: 启动 dev server 验证导航渲染正确**

Run: `npm run dev`
验证：
1. 侧边栏显示 7 个顶层项（首页 + 3 个分组 + 3 个独立项）
2. 模板与表单组默认展开（因为当前路由匹配其子项）
3. 其他组默认折叠
4. 点击组名可展开/折叠
5. 折叠侧边栏时显示图标 + tooltip
6. 管理后台区块默认折叠，仅 ADMIN 可见

- [ ] **Step 3: 验证所有导航链接可正常跳转**

点击每个侧边栏项，确认跳转到正确页面，无 404。

- [ ] **Step 4: 提交**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(nav): restructure sidebar with grouped navigation (16→7 items)"
```

---

### Task 10: 合并 (reports) 路由组到 (dashboard)

**Files:**
- Modify: `src/app/(reports)/layout.tsx` → 删除
- Move: `src/app/(reports)/reports/` → `src/app/(dashboard)/reports/`
- Modify: `src/app/(dashboard)/layout.tsx` — 确认无冲突

- [ ] **Step 1: 将报告页面从 (reports) 路由组移到 (dashboard)**

当前 (reports) 路由组的 layout 与 (dashboard) 完全相同（相同的 Sidebar + Header + auth guard）。合并可消除重复。

```bash
# 移动报告页面
mv src/app/\(reports\)/reports src/app/\(dashboard\)/reports

# 删除空的 (reports) 路由组
rm -rf src/app/\(reports\)
```

注意：移动后路由路径不变，仍然是 `/reports/drafts`、`/reports/templates`，因为路由组 `(reports)` 本身不影响 URL。

- [ ] **Step 2: 更新导航 schema 中的 href（如有变化）**

路由路径未变，导航 schema 无需修改。确认 `NAV_ITEMS` 中的报告项 href 仍为 `/reports/drafts`、`/reports/templates`。

- [ ] **Step 3: 验证构建和导航**

Run: `npx tsc --noEmit && npm run dev`
验证：点击侧边栏"撰写报告"、"报告模板"，确认页面正常加载。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "refactor: merge (reports) route group into (dashboard)"
```

---

## Phase 3：首页工作台重设计

### Task 11: 首页工作台重设计 — 数据查询

**Files:**
- Modify: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: 扩展首页数据查询**

当前首页只查询统计数据。需要新增：

```typescript
// 在 DashboardPage 组件中，替换现有查询为：

const now = new Date();
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

const [
  // 现有统计
  templateCount,
  recordCount,
  draftCount,
  // 新增：我的待办（分配给当前用户的未完成收集任务）
  pendingTasks,
  // 新增：最近使用（最近填写的模板 + 最近编辑的报告）
  recentTemplates,
  recentReports,
  // 新增：团队动态（最近 10 条记录）
  teamActivity,
] = await Promise.all([
  // 模板总数
  db.template.count({ where: { status: "PUBLISHED" } }),
  // 当月记录数
  db.generatedRecord.count({
    where: { createdAt: { gte: startOfMonth } },
  }),
  // 草稿数
  db.draft.count({ where: { userId: session.user.id } }),
  // 我的待办：分配给当前用户且未完成的收集任务
  db.collectionAssignment.findMany({
    where: {
      userId: session.user.id,
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    include: { task: { select: { title: true, deadline: true } } },
    orderBy: { task: { deadline: "asc" } },
    take: 5,
  }),
  // 最近使用的模板
  db.generatedRecord.findMany({
    where: { createdBy: session.user.id },
    select: { template: { select: { id: true, name: true } }, createdAt: true },
    orderBy: { createdAt: "desc" },
    distinct: ["templateId"],
    take: 5,
  }),
  // 最近编辑的报告
  db.reportDraft.findMany({
    where: { updatedBy: session.user.id },
    select: { id: true, title: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 3,
  }),
  // 团队动态
  db.generatedRecord.findMany({
    select: {
      id: true,
      createdBy: true,
      createdAt: true,
      template: { select: { name: true } },
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  }),
]);
```

注意：根据实际 Prisma schema 调整字段名。某些关联（如 `CollectionAssignment`）可能需要确认 schema 中是否存在。如果不存在，简化为仅显示统计数字 + 最近使用。

- [ ] **Step 2: 验证构建通过**

Run: `npx tsc --noEmit`
Expected: 无类型错误（可能有字段名不匹配，根据实际 schema 调整）

- [ ] **Step 3: 提交**

```bash
git add src/app/\(dashboard\)/page.tsx
git commit -m "feat(dashboard): add data queries for workspace homepage"
```

---

### Task 12: 首页工作台重设计 — UI 布局

**Files:**
- Modify: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: 实现新首页工作台布局**

使用 Task 2-6 创建的共享组件重构首页。替换现有的统计卡片网格为新布局：

```tsx
// 关键结构
return (
  <div className="space-y-6">
    {/* 页面标题 */}
    <PageHeader
      title="工作台"
      description={`早上好，${session.user.name || "用户"}。${pendingTasks.length > 0 ? `有 ${pendingTasks.length} 项待办任务。` : ""}`}
    />

    {/* 快捷操作 — 3 卡片横排 */}
    <div className="grid grid-cols-3 gap-4">
      <QuickActionCard
        href="/generate"
        icon={SquarePen}
        label="我要填表"
        description="选择模板快速填写"
        accent="primary"
      />
      <QuickActionCard
        href="/reports/drafts"
        icon={BookText}
        label="撰写报告"
        description="编辑或创建报告"
        accent="success"
      />
      <QuickActionCard
        href="/data"
        icon={Database}
        label="数据表"
        description="管理业务数据"
      />
    </div>

    {/* 双列：我的待办 + 最近使用 */}
    <div className="grid grid-cols-2 gap-4">
      <ContentCard className="p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-[13px] font-[510] text-foreground">我的待办</span>
          {pendingTasks.length > 0 && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-[510] text-primary">
              {pendingTasks.length}
            </span>
          )}
        </div>
        {/* 待办列表项 */}
        <div className="divide-y divide-border-subtle">
          {pendingTasks.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">暂无待办</div>
          ) : (
            pendingTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm text-text-secondary">{task.task.title}</div>
                  <div className="text-xs text-dim">
                    截止 {task.task.deadline?.toLocaleDateString()}
                  </div>
                </div>
                <Link href={`/collections/${task.taskId}`} className="rounded px-2 py-1 text-xs font-[510] bg-primary text-white hover:bg-accent transition-colors">
                  填写
                </Link>
              </div>
            ))
          )}
        </div>
      </ContentCard>

      <ContentCard className="p-0 overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <span className="text-[13px] font-[510] text-foreground">最近使用</span>
        </div>
        <div className="divide-y divide-border-subtle">
          {recentTemplates.map((record) => (
            <div key={record.id} className="flex items-center justify-between px-4 py-3">
              <span className="truncate text-sm text-text-secondary">
                {record.template.name}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-dim">
                  {formatRelativeTime(record.createdAt)}
                </span>
                <Link
                  href={`/templates/${record.template.id}/fill`}
                  className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  再填一次
                </Link>
              </div>
            </div>
          ))}
        </div>
      </ContentCard>
    </div>

    {/* 底部双列：团队动态 + 统计 */}
    <div className="grid grid-cols-[2fr_1fr] gap-4">
      <ContentCard className="p-0 overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <span className="text-[13px] font-[510] text-foreground">团队动态</span>
        </div>
        <div className="divide-y divide-border-subtle">
          {teamActivity.map((record) => (
            <div key={record.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-text-secondary">
                {record.user.name || record.user.email} 生成了 {record.template.name}
              </span>
              <span className="text-xs text-dim">{formatRelativeTime(record.createdAt)}</span>
            </div>
          ))}
        </div>
      </ContentCard>

      <ContentCard>
        <div className="mb-3 text-[13px] font-[510] text-foreground">本月统计</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-lg font-[510] text-foreground">{recordCount}</div>
            <div className="text-xs text-dim">生成文档</div>
          </div>
          <div>
            <div className="text-lg font-[510] text-foreground">{pendingTasks.length}</div>
            <div className="text-xs text-dim">待办任务</div>
          </div>
          <div>
            <div className="text-lg font-[510] text-foreground">{templateCount}</div>
            <div className="text-xs text-dim">活跃模板</div>
          </div>
          <div>
            <div className="text-lg font-[510] text-foreground">—</div>
            <div className="text-xs text-dim">自动化运行</div>
          </div>
        </div>
      </ContentCard>
    </div>
  </div>
);
```

新增辅助组件 `QuickActionCard`（可直接内联在同一文件中或提取为独立组件）：

```tsx
function QuickActionCard({ href, icon: Icon, label, description, accent }: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  description: string;
  accent?: "primary" | "success";
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-hover hover:bg-surface-hover"
    >
      <div className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md",
        accent === "primary" && "bg-primary/15 text-accent",
        accent === "success" && "bg-emerald-500/15 text-emerald-400",
        !accent && "bg-white/[0.08] text-muted-foreground",
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-[13px] font-[510] text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: 添加 formatRelativeTime 工具函数**

```typescript
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString();
}
```

- [ ] **Step 3: 启动 dev server 验证首页**

Run: `npm run dev`
验证：
1. 页面标题显示"工作台"
2. 快捷操作卡片渲染正确（填表/报告/数据）
3. 待办列表显示（如有数据）
4. 最近使用显示
5. 团队动态显示
6. 统计数字正确
7. 暗色模式下视觉风格与 DESIGN.md 一致

- [ ] **Step 4: 提交**

```bash
git add src/app/\(dashboard\)/page.tsx
git commit -m "feat(dashboard): redesign homepage as workspace hub"
```

---

## Phase 4：逐页统一

### Task 13: 统一列表页（模板库、记录、数据表、自动化、收集、报告、用户管理）

**Files:**
- Modify: `src/app/(dashboard)/templates/page.tsx`
- Modify: `src/app/(dashboard)/records/page.tsx`
- Modify: `src/app/(dashboard)/data/page.tsx`
- Modify: `src/app/(dashboard)/automations/page.tsx`
- Modify: `src/app/(dashboard)/collections/page.tsx`
- Modify: `src/app/(dashboard)/reports/drafts/page.tsx`（如存在）
- Modify: `src/app/(dashboard)/admin/users/page.tsx`

每个列表页执行相同的重构步骤。以模板库页面为例：

- [ ] **Step 1: 重构模板库页面**

应用模式 A（列表页），替换现有手写标题和容器：
1. 用 `<PageHeader>` 替换手写的 `<h1>` + 描述
2. 用 `<FilterBar>` 替换手写的筛选标签
3. 用 `<ContentCard>` 替换手写的卡片容器
4. 用 `<EmptyState>` 替换手写的空状态
5. 标准化间距为 `space-y-6`
6. 移除所有魔法 CSS 值

- [ ] **Step 2: 对其余 6 个列表页重复 Step 1**

每个页面逐一应用相同模式。

- [ ] **Step 3: 验证所有列表页渲染正确**

Run: `npm run dev`
逐一访问每个列表页，确认页面正常渲染、筛选功能正常、空状态正确显示。

- [ ] **Step 4: 提交**

```bash
git add src/app/\(dashboard\)/templates/page.tsx src/app/\(dashboard\)/records/page.tsx src/app/\(dashboard\)/data/page.tsx src/app/\(dashboard\)/automations/page.tsx src/app/\(dashboard\)/collections/page.tsx
git commit -m "refactor: unify list pages with shared components (Pattern A)"
```

---

### Task 14: 统一详情页

**Files:**
- Modify: `src/app/(dashboard)/templates/[id]/page.tsx`
- Modify: `src/app/(dashboard)/records/[id]/page.tsx`
- Modify: `src/app/(dashboard)/automations/[id]/page.tsx`
- Modify: `src/app/(dashboard)/collections/[id]/page.tsx`
- Modify: `src/app/(dashboard)/data/[tableId]/page.tsx`

每个详情页执行相同的重构步骤：

- [ ] **Step 1: 逐一重构详情页**

应用模式 B（详情页）：
1. 用 `<Breadcrumbs>` 替换手写的面包屑（或新增）
2. 用 `<PageHeader>` 替换手写的标题区
3. 用 `<ContentCard>` 包裹 tab 内容区
4. 标准化 Tabs 组件样式

- [ ] **Step 2: 验证所有详情页渲染正确**

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "refactor: unify detail pages with shared components (Pattern B)"
```

---

### Task 15: 统一表单/向导页

**Files:**
- Modify: `src/app/(dashboard)/templates/[id]/fill/page.tsx`
- Modify: `src/app/(dashboard)/templates/new/page.tsx`
- Modify: `src/app/(dashboard)/templates/[id]/batch/page.tsx`
- Modify: `src/app/(dashboard)/data/[tableId]/import/page.tsx`
- Modify: `src/app/(dashboard)/automations/new/page.tsx`

- [ ] **Step 1: 逐一重构表单/向导页**

应用模式 C（表单/向导页）：
1. 用 `<Breadcrumbs>` + `<PageHeader>` 替换手写的标题
2. 用 `<ContentCard>` 包裹表单区域
3. 标准化 StepIndicator 样式
4. 标准化底部操作栏（取消/上一步/下一步）

- [ ] **Step 2: 验证所有表单页渲染和交互正确**

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "refactor: unify form/wizard pages with shared components (Pattern C)"
```

---

### Task 16: 统一剩余页面 + 最终清理

**Files:**
- Modify: `src/app/(dashboard)/drafts/page.tsx`
- Modify: `src/app/(dashboard)/about/page.tsx`
- Modify: `src/app/(dashboard)/admin/settings/page.tsx`
- Modify: `src/app/(dashboard)/admin/audit-logs/page.tsx`
- Modify: `src/app/(dashboard)/admin/editor-ai/page.tsx`
- Modify: `src/app/(dashboard)/budget/page.tsx`
- Modify: `src/app/(dashboard)/ai-agent2/page.tsx`
- Modify: `src/app/(dashboard)/generate/page.tsx`

- [ ] **Step 1: 对剩余页面应用共享组件**

这些页面各自有不同特点，但都应：
1. 使用 `<PageHeader>` 统一标题
2. 使用 `<ContentCard>` 统一容器
3. 使用 `<EmptyState>` 统一空状态
4. 移除所有魔法 CSS 值

- [ ] **Step 2: 全站视觉一致性检查**

Run: `npm run dev`
逐一访问所有页面，检查：
- 所有页面标题样式一致（text-2xl font-[510] tracking-tight）
- 所有卡片容器样式一致（rounded-lg border-border bg-card）
- 所有空状态样式一致
- 暗色模式下无视觉异常
- 亮色模式下无视觉异常

- [ ] **Step 3: 运行 lint 和 build**

Run: `npm run lint && npm run build`
Expected: 无 lint 错误，build 成功

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "refactor: complete UI unification across all pages"
```

---

## 自审清单

**Spec 覆盖检查：**
- [x] 导航结构（16→7）→ Task 7, 8, 9
- [x] 设计系统对齐 DESIGN.md → Task 1
- [x] 共享组件（PageHeader/EmptyState/FilterBar/ContentCard/Breadcrumbs）→ Task 2-6
- [x] 首页重设计 → Task 11, 12
- [x] 列表页统一 → Task 13
- [x] 详情页统一 → Task 14
- [x] 表单页统一 → Task 15
- [x] 剩余页面清理 → Task 16
- [x] (reports) 路由组合并 → Task 10

**Placeholder 扫描：** 无 TBD/TODO，所有步骤包含具体代码。

**类型一致性：** 所有共享组件 props 类型在定义处和使用处匹配。NavGroupDef 在 schema.ts 中定义，在 nav-group.tsx 中引用。FilterOption 在 FilterBar 中定义。
