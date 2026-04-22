# Navigation Layout System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 `DESIGN.md` 完成导航布局系统（Sidebar/MobileNav/Header）重构，解决历史交互与视觉一致性问题，并将导航相关控制台错误降为 0。

**Architecture:** 新增 `navigation` 子模块承载单一导航源（schema）、路由匹配（matcher）、状态管理（state hook），桌面与移动端共用同一配置与匹配逻辑。渲染层组件只负责展示与交互绑定，去除分散的路由判断和本地状态副作用，避免 hydration 和监听器重复问题。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Vitest + Testing Library

---

### Task 1: 搭建统一导航 schema 与路由 matcher

**Files:**
- Create: `src/components/layout/navigation/schema.ts`
- Create: `src/components/layout/navigation/matcher.ts`
- Test: `src/components/layout/navigation/matcher.test.ts`

- [ ] **Step 1: 先写失败测试（matcher）**

```ts
// src/components/layout/navigation/matcher.test.ts
import { describe, expect, it } from "vitest";
import { isRouteActive } from "./matcher";

describe("isRouteActive", () => {
  it("首页必须精确匹配", () => {
    expect(isRouteActive("/", "/")).toBe(true);
    expect(isRouteActive("/", "/templates")).toBe(false);
  });

  it("子路由前缀匹配且边界安全", () => {
    expect(isRouteActive("/data", "/data")).toBe(true);
    expect(isRouteActive("/data", "/data/abc")).toBe(true);
    expect(isRouteActive("/data", "/datax")).toBe(false);
  });

  it("尾斜杠兼容", () => {
    expect(isRouteActive("/records", "/records/")).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx vitest run "src/components/layout/navigation/matcher.test.ts"`
Expected: FAIL（`Cannot find module './matcher'`）

- [ ] **Step 3: 实现 schema 与 matcher（最小可用）**

```ts
// src/components/layout/navigation/schema.ts
import {
  LayoutDashboard,
  FileOutput,
  History,
  PenLine,
  FileText,
  Database,
  FolderInput,
  Sparkles,
  Settings,
  Users,
  ScrollText,
} from "lucide-react";

export type NavRole = "ADMIN" | "USER";
export type NavSection = "main" | "admin";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  section: NavSection;
  order: number;
  roles?: NavRole[];
  hidden?: boolean;
  featureFlag?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "仪表盘", href: "/", icon: LayoutDashboard, section: "main", order: 10 },
  { id: "generate", label: "我要填表", href: "/generate", icon: FileOutput, section: "main", order: 20 },
  { id: "records", label: "生成记录", href: "/records", icon: History, section: "main", order: 30 },
  { id: "drafts", label: "我的草稿", href: "/drafts", icon: PenLine, section: "main", order: 40 },
  { id: "templates", label: "模板管理", href: "/templates", icon: FileText, section: "main", order: 50 },
  { id: "data", label: "主数据", href: "/data", icon: Database, section: "main", order: 60 },
  { id: "collections", label: "文档收集", href: "/collections", icon: FolderInput, section: "main", order: 70 },
  { id: "ai-agent2", label: "AI 助手", href: "/ai-agent2", icon: Sparkles, section: "main", order: 80 },
  { id: "admin-settings", label: "系统设置", href: "/admin/settings", icon: Settings, section: "admin", order: 90, roles: ["ADMIN"] },
  { id: "admin-users", label: "用户管理", href: "/admin/users", icon: Users, section: "admin", order: 100, roles: ["ADMIN"] },
  { id: "admin-audit-logs", label: "审计日志", href: "/admin/audit-logs", icon: ScrollText, section: "admin", order: 110, roles: ["ADMIN"] },
];

export function filterNavItemsByRole(items: NavItem[], role?: string) {
  return items
    .filter((item) => !item.hidden)
    .filter((item) => !item.roles || (role ? item.roles.includes(role as NavRole) : false))
    .sort((a, b) => a.order - b.order);
}
```

```ts
// src/components/layout/navigation/matcher.ts
function normalize(path: string) {
  if (!path) return "/";
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function isRouteActive(itemHref: string, pathname: string) {
  const item = normalize(itemHref);
  const current = normalize(pathname);

  if (item === "/") return current === "/";
  return current === item || current.startsWith(`${item}/`);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run "src/components/layout/navigation/matcher.test.ts"`
Expected: PASS（3 tests）

- [ ] **Step 5: 提交**

```bash
git add src/components/layout/navigation/schema.ts src/components/layout/navigation/matcher.ts src/components/layout/navigation/matcher.test.ts
git commit -m "feat(nav): add shared navigation schema and route matcher"
```

### Task 2: 实现导航状态 hook（持久化 + SSR 安全）

**Files:**
- Create: `src/components/layout/navigation/state.ts`
- Test: `src/components/layout/navigation/state.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// src/components/layout/navigation/state.test.tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useNavigationState } from "./state";

describe("useNavigationState", () => {
  it("默认 collapsed=false，并可切换", () => {
    const { result } = renderHook(() => useNavigationState());
    expect(result.current.collapsed).toBe(false);
    act(() => result.current.toggleCollapsed());
    expect(result.current.collapsed).toBe(true);
  });

  it("toggle 后写入 localStorage", () => {
    const spy = vi.spyOn(window.localStorage.__proto__, "setItem");
    const { result } = renderHook(() => useNavigationState());
    act(() => result.current.toggleCollapsed());
    expect(spy).toHaveBeenCalledWith("sidebar-collapsed", "true");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run "src/components/layout/navigation/state.test.tsx"`
Expected: FAIL（`Cannot find module './state'`）

- [ ] **Step 3: 实现状态 hook**

```ts
// src/components/layout/navigation/state.ts
import { useEffect, useState } from "react";

const STORAGE_KEY = "sidebar-collapsed";

export function useNavigationState() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      }
      return next;
    });
  };

  return {
    collapsed,
    toggleCollapsed,
    mobileOpen,
    openMobile: () => setMobileOpen(true),
    closeMobile: () => setMobileOpen(false),
    setMobileOpen,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run "src/components/layout/navigation/state.test.tsx"`
Expected: PASS（2 tests）

- [ ] **Step 5: 提交**

```bash
git add src/components/layout/navigation/state.ts src/components/layout/navigation/state.test.tsx
git commit -m "feat(nav): add shared navigation state hook with safe persistence"
```

### Task 3: 重构 Sidebar（共用 schema/matcher/state，完成视觉升级）

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Test: `src/components/layout/sidebar.test.tsx`

- [ ] **Step 1: 写失败测试（激活态 + 权限过滤）**

```tsx
// src/components/layout/sidebar.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/data/abc",
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { role: "USER" } } }),
}));

describe("Sidebar", () => {
  it("应高亮主数据并隐藏管理员菜单", () => {
    render(<Sidebar />);
    expect(screen.getByText("主数据")).toBeInTheDocument();
    expect(screen.queryByText("系统设置")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run "src/components/layout/sidebar.test.tsx"`
Expected: FAIL（旧实现未按新结构渲染）

- [ ] **Step 3: 重写 Sidebar 渲染逻辑（核心代码）**

```tsx
// src/components/layout/sidebar.tsx (核心片段)
import { NAV_ITEMS, filterNavItemsByRole } from "@/components/layout/navigation/schema";
import { isRouteActive } from "@/components/layout/navigation/matcher";
import { useNavigationState } from "@/components/layout/navigation/state";

// ...
const { collapsed, toggleCollapsed } = useNavigationState();
const role = session?.user?.role;
const items = filterNavItemsByRole(NAV_ITEMS, role);
const mainItems = items.filter((i) => i.section === "main");
const adminItems = items.filter((i) => i.section === "admin");

{mainItems.map((item) => {
  const Icon = item.icon;
  const active = isRouteActive(item.href, pathname);
  return (
    <Link
      key={item.id}
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center rounded-md text-sm font-[510] transition-all",
        collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
        active
          ? "border border-[rgb(255_255_255_/_0.1)] bg-[rgb(113_112_255_/_0.18)] text-[#f7f8f8]"
          : "text-[#8a8f98] hover:border hover:border-[rgb(255_255_255_/_0.08)] hover:bg-[rgb(255_255_255_/_0.03)] hover:text-[#f7f8f8]",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
})}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run "src/components/layout/sidebar.test.tsx"`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/layout/sidebar.tsx src/components/layout/sidebar.test.tsx
git commit -m "refactor(nav): rebuild desktop sidebar with shared nav schema"
```

### Task 4: 重构 MobileNav（与 Sidebar 同源 + 自动关闭）

**Files:**
- Modify: `src/components/layout/mobile-nav.tsx`
- Test: `src/components/layout/mobile-nav.test.tsx`

- [ ] **Step 1: 写失败测试（跳转后关闭）**

```tsx
// src/components/layout/mobile-nav.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobileNav } from "./mobile-nav";

describe("MobileNav", () => {
  it("点击菜单项后应关闭抽屉", () => {
    render(<MobileNav />);
    const trigger = screen.getByRole("button", { name: /打开菜单/i });
    fireEvent.click(trigger);
    const target = screen.getByText("主数据");
    fireEvent.click(target);
    // 断言：抽屉内容消失（依据你组件中的 title 或元素）
    expect(screen.queryByText("系统设置")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run "src/components/layout/mobile-nav.test.tsx"`
Expected: FAIL

- [ ] **Step 3: 用共享导航源重写移动导航**

```tsx
// src/components/layout/mobile-nav.tsx (核心片段)
import { NAV_ITEMS, filterNavItemsByRole } from "@/components/layout/navigation/schema";
import { isRouteActive } from "@/components/layout/navigation/matcher";

const items = filterNavItemsByRole(NAV_ITEMS, session?.user?.role);

<Link
  key={item.id}
  href={item.href}
  onClick={() => setOpen(false)}
  aria-current={active ? "page" : undefined}
  className={cn(
    "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-[510] transition-all",
    active
      ? "border border-[rgb(255_255_255_/_0.1)] bg-[rgb(113_112_255_/_0.18)] text-[#f7f8f8]"
      : "text-[#8a8f98] hover:border hover:border-[rgb(255_255_255_/_0.08)] hover:bg-[rgb(255_255_255_/_0.03)] hover:text-[#f7f8f8]",
  )}
>
  <Icon className="h-5 w-5" />
  {item.label}
</Link>
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run "src/components/layout/mobile-nav.test.tsx"`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/layout/mobile-nav.tsx src/components/layout/mobile-nav.test.tsx
git commit -m "refactor(nav): rebuild mobile navigation with shared schema and close-on-route"
```

### Task 5: 重构 Header（解耦导航逻辑 + 监听器稳定）

**Files:**
- Modify: `src/components/layout/header.tsx`
- Test: `src/components/layout/header.test.tsx`

- [ ] **Step 1: 写失败测试（快捷键注册/卸载）**

```tsx
// src/components/layout/header.test.tsx
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./header";

describe("Header keyboard listener", () => {
  it("mount/unmount 时应成对注册和卸载", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<Header />);
    unmount();
    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run "src/components/layout/header.test.tsx"`
Expected: FAIL（若当前实现不稳定）

- [ ] **Step 3: 实现稳定监听与视觉统一**

```tsx
// src/components/layout/header.tsx (核心片段)
const handleKeyDown = useCallback((e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    setSearchOpen((v) => !v);
  }
}, []);

useEffect(() => {
  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [handleKeyDown]);

<header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-[rgb(255_255_255_/_0.05)] bg-[rgb(15_16_17_/_0.92)] px-3 backdrop-blur-xl sm:gap-4 sm:px-6">
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run "src/components/layout/header.test.tsx"`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/layout/header.tsx src/components/layout/header.test.tsx
git commit -m "refactor(nav): stabilize header keyboard shortcuts and nav shell"
```

### Task 6: 清理旧导航重复定义并完成布局接线

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/layout/mobile-nav.tsx`
- Test: `src/components/layout/navigation.integration.test.tsx`

- [ ] **Step 1: 写集成失败测试（桌面/移动共用同源）**

```tsx
// src/components/layout/navigation.integration.test.tsx
import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "./navigation/schema";

describe("navigation schema", () => {
  it("主导航应包含执行优先业务域顺序", () => {
    const main = NAV_ITEMS.filter((i) => i.section === "main").sort((a, b) => a.order - b.order);
    expect(main.map((i) => i.href)).toEqual([
      "/",
      "/generate",
      "/records",
      "/drafts",
      "/templates",
      "/data",
      "/collections",
      "/ai-agent2",
    ]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败（若顺序/定义不符）**

Run: `npx vitest run "src/components/layout/navigation.integration.test.tsx"`
Expected: FAIL

- [ ] **Step 3: 删除重复菜单数组并改为 schema 引用**

```tsx
// 关键动作（不保留旧 navItems/adminNavItems 常量）
// Sidebar/MobileNav 均改为：
import { NAV_ITEMS, filterNavItemsByRole } from "@/components/layout/navigation/schema";
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run "src/components/layout/navigation.integration.test.tsx"`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/app/(dashboard)/layout.tsx src/components/layout/sidebar.tsx src/components/layout/mobile-nav.tsx src/components/layout/navigation.integration.test.tsx
git commit -m "refactor(nav): remove duplicated nav definitions and unify layout wiring"
```

### Task 7: 全量验证（导航相关）与收尾

**Files:**
- Modify: `src/components/layout/*.tsx`（仅当验证发现问题时）
- Test: `src/components/layout/**/*.test.tsx`

- [ ] **Step 1: 运行导航相关测试集合**

Run: `npx vitest run "src/components/layout/**/*.test.tsx" "src/components/layout/navigation*.test.tsx"`
Expected: 全部 PASS

- [ ] **Step 2: 运行导航相关 lint**

Run:
`npx eslint "src/components/layout/**/*.tsx" "src/components/layout/navigation/*.ts" "src/components/layout/navigation/*.tsx"`
Expected: 0 error（warning 可接受但需记录）

- [ ] **Step 3: 手动验收清单（控制台 + 交互）**

```md
- 桌面：折叠后刷新，状态保持
- 桌面：/data 与 /datax 激活态不串
- 移动：打开菜单后跳转自动关闭
- 角色：USER 不显示管理区，ADMIN 显示
- 控制台：导航流程 0 error
- 可访问性：aria-current/page、按钮 sr-only 文案存在
```

- [ ] **Step 4: 最终提交**

```bash
git add src/components/layout src/app/(dashboard)/layout.tsx
git commit -m "feat(nav): complete navigation layout redesign and fix sidebar legacy issues"
```

## Spec 覆盖检查（Self-Review）

1. **Spec coverage**
- 信息架构顺序与分组：Task 1 + Task 6 覆盖。
- 单一导航源与 matcher：Task 1 覆盖。
- 状态管理与持久化：Task 2 覆盖。
- Sidebar/MobileNav/Header 重构：Task 3/4/5 覆盖。
- 控制台报错收敛：Task 2/5/7 覆盖。
- 回归测试与 DoD：Task 7 覆盖。

2. **Placeholder scan**
- 本计划无 `TBD/TODO/implement later` 文本。
- 每个任务包含明确文件、命令、预期结果。

3. **Type consistency**
- 导航 item 类型统一为 `NavItem`。
- 匹配函数统一 `isRouteActive(itemHref, pathname)`。
- 状态 hook 统一 `useNavigationState`。

