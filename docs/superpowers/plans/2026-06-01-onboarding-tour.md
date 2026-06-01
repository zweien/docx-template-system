# 新用户引导 Tour 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用 Driver.js 实现新用户首次登录引导 Tour，包含 10 步界面介绍和核心流程演示。

**Architecture:** TourProvider 包裹 dashboard layout，管理 Driver.js 实例生命周期。Zustand store 管理 Tour 运行状态，Prisma 新增字段追踪用户引导完成状态。跨页面步骤通过 router.push + TourProvider 路由监听恢复。

**Tech Stack:** Driver.js、Zustand、Prisma、shadcn/ui Dialog、Next.js App Router

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/stores/onboarding-store.ts` | Zustand store — Tour 运行状态 |
| Create | `src/lib/services/onboarding.service.ts` | 标记引导完成的服务函数 |
| Create | `src/components/onboarding/tour-steps.ts` | 10 步步骤定义 |
| Create | `src/components/onboarding/use-tour.ts` | Driver.js 封装 hook |
| Create | `src/components/onboarding/welcome-dialog.tsx` | 首次登录欢迎弹窗 |
| Create | `src/components/onboarding/tour-completion.tsx` | 引导完成弹窗 |
| Create | `src/components/onboarding/tour-provider.tsx` | TourProvider 上下文组件 |
| Create | `src/components/onboarding/driver-theme.css` | Driver.js 主题覆盖样式 |
| Create | `src/app/api/user/onboarding/route.ts` | PATCH API — 标记完成 |
| Modify | `prisma/schema.prisma:35` | User 表新增 onboardingCompleted + onboardingVersion |
| Modify | `src/app/(dashboard)/layout.tsx:19-31` | 包裹 TourProvider |
| Modify | `src/components/layout/sidebar.tsx:78` | 添加 id="sidebar-nav" |
| Modify | `src/components/layout/sidebar.tsx:165-177` | 底部添加"新手引导"链接 |
| Modify | `src/components/layout/header.tsx:99` | 添加 id="header-search" |
| Modify | `src/components/layout/header.tsx:110-112` | 包裹 id="user-nav" + 添加"?"按钮 |
| Modify | `src/app/(dashboard)/page.tsx:182` | 添加 id="quick-actions" |
| Modify | `src/app/(dashboard)/generate/generate-page-client.tsx:143` | 添加 id="template-list" |
| Modify | `src/components/forms/dynamic-form.tsx:268` | 添加 id="form-area" |
| Modify | `src/components/forms/dynamic-form.tsx:378` | 添加 id="submit-btn" |
| Modify | `src/app/(dashboard)/records/page.tsx:107` | 添加 id="records-page" |

---

### Task 1: 安装 Driver.js 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 driver.js**

```bash
npm install driver.js
```

- [ ] **Step 2: 验证安装成功**

```bash
grep '"driver.js"' package.json
```

Expected: 显示 `"driver.js": "^x.x.x"`

- [ ] **Step 3: 提交**

```bash
git add package.json package-lock.json
git commit -m "chore: add driver.js dependency for onboarding tour"
```

---

### Task 2: 更新 Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma:35`（User model，在 `role` 字段之后）

- [ ] **Step 1: 添加 onboarding 字段到 User model**

在 `prisma/schema.prisma` 的 User model 中，`role` 字段之后、`createdAt` 之前添加：

```prisma
  onboardingCompleted Boolean @default(false)
  onboardingVersion   Int    @default(1)
```

- [ ] **Step 2: 推送到数据库**

```bash
npx prisma db push
```

Expected: 成功输出，表已更新

- [ ] **Step 3: 重新生成 Prisma client**

```bash
npx prisma generate
```

Expected: 成功输出

- [ ] **Step 4: 提交**

```bash
git add prisma/schema.prisma
git commit -m "feat: add onboarding fields to User model"
```

---

### Task 3: 创建 Onboarding Service

**Files:**
- Create: `src/lib/services/onboarding.service.ts`

- [ ] **Step 1: 创建服务文件**

```typescript
import { db } from "@/lib/db";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export async function markOnboardingCompleted(
  userId: string
): Promise<ServiceResult<{ completed: boolean }>> {
  try {
    await db.user.update({
      where: { id: userId },
      data: { onboardingCompleted: true },
    });
    return { success: true, data: { completed: true } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "更新引导状态失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/services/onboarding.service.ts
git commit -m "feat: add onboarding service for marking tour complete"
```

---

### Task 4: 创建 Onboarding API Route

**Files:**
- Create: `src/app/api/user/onboarding/route.ts`

- [ ] **Step 1: 创建 API route**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markOnboardingCompleted } from "@/lib/services/onboarding.service";

export async function PATCH() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const result = await markOnboardingCompleted(session.user.id);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(result.data);
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/api/user/onboarding/route.ts
git commit -m "feat: add PATCH /api/user/onboarding endpoint"
```

---

### Task 5: 创建 Onboarding Zustand Store

**Files:**
- Create: `src/lib/stores/onboarding-store.ts`

- [ ] **Step 1: 创建 store**

```typescript
import { create } from "zustand";

interface OnboardingStore {
  isActive: boolean;
  currentStep: number;
  start: () => void;
  stop: () => void;
  setStep: (step: number) => void;
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  isActive: false,
  currentStep: 0,
  start: () => set({ isActive: true, currentStep: 0 }),
  stop: () => set({ isActive: false }),
  setStep: (step) => set({ currentStep: step }),
}));
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/stores/onboarding-store.ts
git commit -m "feat: add onboarding Zustand store for tour state"
```

---

### Task 6: 创建 Tour 步骤定义

**Files:**
- Create: `src/components/onboarding/tour-steps.ts`

- [ ] **Step 1: 创建步骤定义**

```typescript
import type { DriveStep } from "driver.js";

export const tourSteps: DriveStep[] = [
  // === 阶段一：界面介绍 ===
  {
    popover: {
      title: "欢迎使用 IDRL 填表系统 👋",
      description:
        "这是一个模板驱动的文档生成平台。接下来带你快速了解核心功能。",
      showButtons: ["next"],
      nextBtnText: "开始引导",
    },
  },
  {
    element: "#sidebar-nav",
    popover: {
      title: "侧边栏导航",
      description:
        "所有功能都从这里访问。导航按用途分组：\n\n• 模板与表单 — 日常最常用\n• 数据中心 — 数据管理\n• 报告中心 — 报告撰写",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#header-search",
    popover: {
      title: "全局搜索",
      description: "点击搜索框或按 ⌘K 可以快速搜索模板、记录和功能。",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "#quick-actions",
    popover: {
      title: "快捷操作",
      description:
        "首页提供常用操作入口：\n\n• 我要填表 — 选择模板生成文档\n• 撰写报告 — 使用模板写报告\n• 数据表 — 管理结构化数据\n\n下方还有待办事项和最近使用的记录。",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "#user-nav",
    popover: {
      title: "个人设置",
      description: "这里可以切换深色/浅色主题、查看通知、管理个人账号。",
      side: "bottom",
      align: "end",
    },
  },
  // === 阶段二：核心流程 ===
  {
    element: "#template-list",
    popover: {
      title: "模板库",
      description:
        "浏览所有可用模板。点击模板卡片即可进入表单填写页面。管理员可以上传和配置新模板。",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "#form-area",
    popover: {
      title: "填写表单",
      description:
        "选择模板后会展示动态表单。根据提示填写各字段内容，系统会自动将数据填充到文档对应位置。",
      side: "left",
      align: "start",
    },
  },
  {
    element: "#submit-btn",
    popover: {
      title: "生成文档",
      description:
        '填写完成后点击"确认生成"按钮，系统将自动生成文档。你也可以先保存为草稿稍后继续。',
      side: "top",
      align: "end",
    },
  },
  {
    element: "#records-page",
    popover: {
      title: "生成记录",
      description:
        "所有生成过的文档都记录在这里。你可以查看状态、重新下载、或查看详情。",
      side: "bottom",
      align: "start",
    },
  },
  {
    popover: {
      title: "引导完成！🎉",
      description:
        '你已了解系统的基本使用方式。随时点击侧边栏底部的"新手引导"或右上角的"?"按钮可以重新查看。',
      showButtons: ["next"],
      nextBtnText: "开始使用",
    },
  },
];

// 跨页面步骤的索引：这些步骤需要先导航到对应页面
export const PAGE_STEP_MAP: Record<number, string> = {
  5: "/generate",   // 步骤 6（index 5）需要先到 /generate
  8: "/records",    // 步骤 9（index 8）需要先到 /records
};
```

- [ ] **Step 2: 提交**

```bash
git add src/components/onboarding/tour-steps.ts
git commit -m "feat: define 10-step onboarding tour with page navigation map"
```

---

### Task 7: 创建 Driver.js 主题样式

**Files:**
- Create: `src/components/onboarding/driver-theme.css`

- [ ] **Step 1: 创建主题 CSS**

```css
.driver-popover.idrl-theme {
  background-color: var(--color-popover);
  color: var(--color-foreground);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-family: inherit;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.driver-popover.idrl-theme .driver-popover-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-foreground);
}

.driver-popover.idrl-theme .driver-popover-description {
  font-size: 13px;
  color: var(--color-text-dim);
  line-height: 1.6;
}

.driver-popover.idrl-theme .driver-popover-progress-text {
  font-size: 11px;
  color: var(--color-primary);
  font-weight: 600;
}

.driver-popover.idrl-theme .driver-popover-navigation-btns {
  justify-content: space-between;
  gap: 8px;
}

.driver-popover.idrl-theme button {
  flex: none;
  background-color: var(--color-primary);
  color: #fff;
  border: none;
  font-size: 13px;
  font-weight: 500;
  padding: 6px 16px;
  border-radius: var(--radius-sm);
  text-shadow: none;
  cursor: pointer;
}

.driver-popover.idrl-theme button:hover {
  opacity: 0.9;
}

.driver-popover.idrl-theme .driver-popover-close-btn {
  background: none;
  color: var(--color-text-dim);
  font-size: 16px;
  padding: 4px;
}

.driver-popover.idrl-theme .driver-popover-close-btn:hover {
  color: var(--color-foreground);
}

.driver-popover.idrl-theme .driver-popover-prev-btn {
  background: var(--color-secondary);
  color: var(--color-text-dim);
  border: 1px solid var(--color-border);
}

.driver-popover.idrl-theme .driver-popover-arrow-side-left.driver-popover-arrow {
  border-left-color: var(--color-popover);
}

.driver-popover.idrl-theme .driver-popover-arrow-side-right.driver-popover-arrow {
  border-right-color: var(--color-popover);
}

.driver-popover.idrl-theme .driver-popover-arrow-side-top.driver-popover-arrow {
  border-top-color: var(--color-popover);
}

.driver-popover.idrl-theme .driver-popover-arrow-side-bottom.driver-popover-arrow {
  border-bottom-color: var(--color-popover);
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/onboarding/driver-theme.css
git commit -m "feat: add custom Driver.js theme matching project design system"
```

---

### Task 8: 创建 use-tour Hook

**Files:**
- Create: `src/components/onboarding/use-tour.ts`

- [ ] **Step 1: 创建 hook**

```typescript
"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./driver-theme.css";
import { tourSteps, PAGE_STEP_MAP } from "./tour-steps";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";

export function useTour() {
  const router = useRouter();
  const pathname = usePathname();
  const { isActive, start: storeStart, stop: storeStop, setStep } = useOnboardingStore();
  const driverRef = useRef<Driver | null>(null);

  const markCompleted = useCallback(async () => {
    try {
      await fetch("/api/user/onboarding", { method: "PATCH" });
    } catch {
      // 静默失败，不影响用户体验
    }
  }, []);

  const destroyDriver = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    destroyDriver();

    const driverInstance = driver({
      showProgress: true,
      progressText: "{{current}} / {{total}}",
      popoverClass: "idrl-theme",
      allowClose: true,
      overlayColor: "black",
      overlayOpacity: 0.5,
      smoothScroll: true,
      steps: tourSteps,
      onNextClick: (_element, _step, { state, driver: d }) => {
        const nextIndex = state.activeIndex + 1;

        // 检查下一步是否需要跨页面跳转
        const requiredPage = PAGE_STEP_MAP[nextIndex];
        if (requiredPage && !pathname.startsWith(requiredPage)) {
          // 先停止当前 driver，导航后由 TourProvider 恢复
          setStep(nextIndex);
          d.destroy();
          driverRef.current = null;
          router.push(requiredPage);
          return;
        }

        d.moveNext();
      },
      onDestroyed: () => {
        storeStop();
        driverRef.current = null;
        markCompleted();
      },
    });

    driverRef.current = driverInstance;
    storeStart();
    driverInstance.drive();
  }, [pathname, router, storeStart, storeStop, setStep, markCompleted, destroyDriver]);

  const resumeFromStep = useCallback(
    (stepIndex: number) => {
      destroyDriver();

      const driverInstance = driver({
        showProgress: true,
        progressText: "{{current}} / {{total}}",
        popoverClass: "idrl-theme",
        allowClose: true,
        overlayColor: "black",
        overlayOpacity: 0.5,
        smoothScroll: true,
        steps: tourSteps,
        onNextClick: (_element, _step, { state, driver: d }) => {
          const nextIndex = state.activeIndex + 1;
          const requiredPage = PAGE_STEP_MAP[nextIndex];
          if (requiredPage && !pathname.startsWith(requiredPage)) {
            setStep(nextIndex);
            d.destroy();
            driverRef.current = null;
            router.push(requiredPage);
            return;
          }
          d.moveNext();
        },
        onDestroyed: () => {
          storeStop();
          driverRef.current = null;
          markCompleted();
        },
      });

      driverRef.current = driverInstance;
      storeStart();
      driverInstance.drive(stepIndex);
    },
    [pathname, router, storeStart, storeStop, setStep, markCompleted, destroyDriver]
  );

  const stop = useCallback(() => {
    destroyDriver();
    storeStop();
    markCompleted();
  }, [destroyDriver, storeStop, markCompleted]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
    };
  }, []);

  return { start, stop, resumeFromStep, isActive };
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/onboarding/use-tour.ts
git commit -m "feat: add useTour hook wrapping Driver.js with cross-page support"
```

---

### Task 9: 创建欢迎弹窗

**Files:**
- Create: `src/components/onboarding/welcome-dialog.tsx`

- [ ] **Step 1: 创建欢迎弹窗组件**

```tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface WelcomeDialogProps {
  open: boolean;
  onStart: () => void;
  onSkip: () => void;
}

export function WelcomeDialog({ open, onStart, onSkip }: WelcomeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onSkip()}>
      <DialogContent
        className="sm:max-w-[420px] text-center"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center">
          <div className="text-4xl mb-2">👋</div>
          <DialogTitle className="text-lg">
            欢迎使用 IDRL 填表系统
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            这是一个模板驱动的文档生成平台。
            <br />
            只需 2 分钟，带你快速了解核心功能。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-4">
          <Button onClick={onStart}>开始引导（约 2 分钟）</Button>
          <Button variant="ghost" className="text-muted-foreground" onClick={onSkip}>
            跳过，稍后再看
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/onboarding/welcome-dialog.tsx
git commit -m "feat: add WelcomeDialog for first-login onboarding prompt"
```

---

### Task 10: 创建 TourProvider

**Files:**
- Create: `src/components/onboarding/tour-provider.tsx`

- [ ] **Step 1: 创建 TourProvider 组件**

这是核心组件，负责：
- 检查用户 onboardingCompleted 状态
- 首次登录时显示欢迎弹窗
- 路由变化时恢复跨页面 Tour
- 提供 useTour hook 给子组件

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";
import { useTour } from "./use-tour";
import { WelcomeDialog } from "./welcome-dialog";

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { isActive, currentStep } = useOnboardingStore();
  const { start, stop, resumeFromStep } = useTour();
  const [showWelcome, setShowWelcome] = useState(false);
  const hasCheckedRef = useRef(false);

  // 首次加载检查是否需要展示欢迎弹窗
  useEffect(() => {
    if (hasCheckedRef.current) return;
    if (!session?.user) return;

    hasCheckedRef.current = true;

    const user = session.user as typeof session.user & {
      onboardingCompleted?: boolean;
    };
    if (!user.onboardingCompleted) {
      setShowWelcome(true);
    }
  }, [session]);

  // 跨页面恢复：路由变化后如果 Tour 处于活跃状态，恢复到对应步骤
  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    if (!isActive) return;
    if (pathname === prevPathnameRef.current) return;
    prevPathnameRef.current = pathname;

    // 等待 DOM 更新后恢复 Tour
    const timer = setTimeout(() => {
      resumeFromStep(currentStep);
    }, 300);

    return () => clearTimeout(timer);
  }, [pathname, isActive, currentStep, resumeFromStep]);

  // 更新 prevPathnameRef
  useEffect(() => {
    prevPathnameRef.current = pathname;
  }, [pathname]);

  const handleStart = useCallback(() => {
    setShowWelcome(false);
    start();
  }, [start]);

  const handleSkip = useCallback(async () => {
    setShowWelcome(false);
    try {
      await fetch("/api/user/onboarding", { method: "PATCH" });
    } catch {
      // 静默失败
    }
  }, []);

  return (
    <>
      <WelcomeDialog
        open={showWelcome}
        onStart={handleStart}
        onSkip={handleSkip}
      />
      {children}
    </>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/onboarding/tour-provider.tsx
git commit -m "feat: add TourProvider with welcome dialog and cross-page resume"
```

---

### Task 11: 添加元素 ID 到现有组件

**Files:**
- Modify: `src/components/layout/sidebar.tsx:78`
- Modify: `src/components/layout/header.tsx:99,110-112`
- Modify: `src/app/(dashboard)/page.tsx:182`
- Modify: `src/app/(dashboard)/generate/generate-page-client.tsx:143`
- Modify: `src/components/forms/dynamic-form.tsx:268,378`
- Modify: `src/app/(dashboard)/records/page.tsx:107`

- [ ] **Step 1: Sidebar — 添加 id="sidebar-nav"**

在 `src/components/layout/sidebar.tsx` 第 78 行的 `<aside>` 元素添加 `id="sidebar-nav"`：

```tsx
// 修改前:
<aside
  className={cn(
    "hidden h-screen shrink-0 flex-col ..."

// 修改后:
<aside
  id="sidebar-nav"
  className={cn(
    "hidden h-screen shrink-0 flex-col ..."
```

- [ ] **Step 2: Header — 添加 id="header-search"**

在 `src/components/layout/header.tsx` 第 99 行的搜索按钮添加 `id="header-search"`：

```tsx
// 修改前:
<button
  onClick={() => setSearchOpen(true)}
  className="hidden h-8 ..."

// 修改后:
<button
  id="header-search"
  onClick={() => setSearchOpen(true)}
  className="hidden h-8 ..."
```

- [ ] **Step 3: Header — 包裹 id="user-nav"**

在 `src/components/layout/header.tsx` 第 110 行，用 div 包裹 ThemeToggle/NotificationBell/UserNav：

```tsx
// 修改前:
<ThemeToggle />
<NotificationBell />
<UserNav />

// 修改后:
<div id="user-nav" className="flex items-center gap-2">
  <ThemeToggle />
  <NotificationBell />
  <UserNav />
</div>
```

- [ ] **Step 4: 首页 — 添加 id="quick-actions"**

在 `src/app/(dashboard)/page.tsx` 第 182 行的快速操作 grid 添加 `id="quick-actions"`：

```tsx
// 修改前:
<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

// 修改后:
<div id="quick-actions" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
```

- [ ] **Step 5: 生成页 — 添加 id="template-list"**

在 `src/app/(dashboard)/generate/generate-page-client.tsx` 第 143 行的模板 grid 添加 `id="template-list"`：

```tsx
// 修改前:
<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

// 修改后:
<div id="template-list" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
```

- [ ] **Step 6: 表单 — 添加 id="form-area"**

在 `src/components/forms/dynamic-form.tsx` 第 268 行的表单容器添加 `id="form-area"`：

```tsx
// 修改前:
<div className="space-y-6">

// 修改后:
<div id="form-area" className="space-y-6">
```

- [ ] **Step 7: 表单 — 添加 id="submit-btn"**

在 `src/components/forms/dynamic-form.tsx` 第 378 行的生成按钮添加 `id="submit-btn"`：

```tsx
// 修改前:
<Button
  onClick={handleGenerate}
  disabled={saving || generating}
  className="w-full sm:w-auto"
>

// 修改后:
<Button
  id="submit-btn"
  onClick={handleGenerate}
  disabled={saving || generating}
  className="w-full sm:w-auto"
>
```

- [ ] **Step 8: 记录页 — 添加 id="records-page"**

在 `src/app/(dashboard)/records/page.tsx` 第 107 行的 ContentCard 添加 `id="records-page"`：

```tsx
// 修改前:
<ContentCard className="!p-0">

// 修改后:
<ContentCard id="records-page" className="!p-0">
```

注意：如果 ContentCard 不支持 `id` prop，需要在 ContentCard 组件中添加 `id` prop 的透传（检查 `src/components/shared/` 中的 ContentCard 定义，通常已通过 `{...props}` 透传）。

- [ ] **Step 9: 提交**

```bash
git add src/components/layout/sidebar.tsx src/components/layout/header.tsx "src/app/(dashboard)/page.tsx" "src/app/(dashboard)/generate/generate-page-client.tsx" src/components/forms/dynamic-form.tsx "src/app/(dashboard)/records/page.tsx"
git commit -m "feat: add element IDs for onboarding tour step targets"
```

---

### Task 12: 添加手动重入口

**Files:**
- Modify: `src/components/layout/header.tsx`（在 ThemeToggle 之前添加"?"按钮）
- Modify: `src/components/layout/sidebar.tsx:165-177`（在 footer 区域添加链接）
- Modify: `src/components/layout/navigation/schema.ts:168-170`（添加 FOOTER_NAV_ITEM）

- [ ] **Step 1: Navigation Schema — 添加"新手引导"到 footer 导航**

在 `src/components/layout/navigation/schema.ts` 的 import 中添加 `GraduationCap`（如果 lucide-react 中有，否则用 `HelpCircle`），然后在 `FOOTER_NAV_ITEMS` 中添加：

```typescript
// 在文件顶部的 icon import 中添加 GraduationCap
import { ..., GraduationCap } from "lucide-react";

// 修改 FOOTER_NAV_ITEMS
export const FOOTER_NAV_ITEMS: readonly NavItem[] = [
  { id: "onboarding", icon: GraduationCap, href: "#onboarding", label: "新手引导", section: "footer", order: 98 },
  { id: "about", icon: Info, href: "/about", label: "关于", section: "footer", order: 99 },
] as const satisfies readonly NavItem[];
```

注意：`href: "#onboarding"` 是占位值，实际点击行为由下一步的 Sidebar 组件拦截处理。

- [ ] **Step 2: Sidebar — 拦截"新手引导"点击**

在 `src/components/layout/sidebar.tsx` 中，修改 `SidebarNavLink` 组件或 `footerItems.map` 区域，拦截 `id === "onboarding"` 的点击事件，调用 `useTour().start()`。

由于 `SidebarNavLink` 是通用组件，最佳方式是在 sidebar 组件内部特殊处理 footer items 的渲染。在 footerItems.map 处，将"新手引导"替换为自定义按钮：

```tsx
// 在 Sidebar 组件内添加 useTour hook
import { useTour } from "@/components/onboarding/use-tour";

// 在 Sidebar 函数组件内部:
const { start: startTour, isActive: tourActive } = useTour();

// 修改 footer 区域渲染，在 footerItems.map 中：
{footerItems.map((item) =>
  item.id === "onboarding" ? (
    <button
      key={item.id}
      onClick={tourActive ? undefined : startTour}
      disabled={tourActive}
      className={cn(
        "flex items-center rounded-md text-sm font-[510] transition-colors w-full text-left",
        collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
        "border border-transparent text-muted-foreground hover:border-border hover:bg-white/[0.03] hover:text-foreground",
        tourActive && "opacity-50 pointer-events-none"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className={cn("whitespace-nowrap", collapsed && "w-0 overflow-hidden opacity-0")}>
        {item.label}
      </span>
    </button>
  ) : (
    <SidebarNavLink key={item.id} item={item} pathname={pathname} collapsed={collapsed} />
  )
)}
```

- [ ] **Step 3: Header — 添加"?"引导按钮**

在 `src/components/layout/header.tsx` 中，在 ThemeToggle 之前添加引导按钮。

首先添加 import：

```tsx
import { HelpCircle } from "lucide-react";
import { useTour } from "@/components/onboarding/use-tour";
import { Tooltip } from "@/components/ui/tooltip";
```

然后在 ThemeToggle 之前插入按钮：

```tsx
// 在 ThemeToggle 之前添加:
<OnboardingTrigger />

// 在 Header 组件外部定义 OnboardingTrigger:
function OnboardingTrigger() {
  const { start, isActive } = useTour();
  return (
    <Tooltip title="新手引导">
      <button
        onClick={isActive ? undefined : start}
        disabled={isActive}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
          "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          isActive && "opacity-50 pointer-events-none"
        )}
      >
        <HelpCircle className="h-4 w-4" />
      </button>
    </Tooltip>
  );
}
```

注意：如果项目的 Tooltip 组件 API 不同，需查看 `src/components/ui/tooltip.tsx` 的实际 API 并调整。

- [ ] **Step 4: 提交**

```bash
git add src/components/layout/navigation/schema.ts src/components/layout/sidebar.tsx src/components/layout/header.tsx
git commit -m "feat: add manual re-entry points for onboarding tour in header and sidebar"
```

---

### Task 13: 集成 TourProvider 到 Dashboard Layout

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: 在 layout 中包裹 TourProvider**

```tsx
// 修改前:
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SessionProvider } from "@/components/providers/session-provider";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <SessionProvider session={session}>
      <div className="flex h-screen bg-background text-foreground">
        ...
      </div>
    </SessionProvider>
  );
}

// 修改后:
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SessionProvider } from "@/components/providers/session-provider";
import { TourProvider } from "@/components/onboarding/tour-provider";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <SessionProvider session={session}>
      <TourProvider>
        <div className="flex h-screen bg-background text-foreground">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header />
            <main className="flex-1 flex flex-col overflow-y-auto bg-transparent p-4 sm:p-6">
              {children}
            </main>
          </div>
        </div>
      </TourProvider>
    </SessionProvider>
  );
}
```

- [ ] **Step 2: 将 onboardingCompleted 传递给 session**

TourProvider 需要通过 session 获取用户的 `onboardingCompleted` 状态。需要在 auth options 中将此字段加入 session。

在 `src/lib/auth-options.ts` 的 callbacks.jwt 和 callbacks.session 中添加 onboardingCompleted：

```typescript
// 在 jwt callback 中:
async jwt({ token, user }) {
  if (user) {
    token.id = user.id;
    token.role = (user as any).role;
    token.onboardingCompleted = (user as any).onboardingCompleted;
  }
  return token;
},

// 在 session callback 中:
async session({ session, token }) {
  if (session.user) {
    session.user.id = token.id as string;
    session.user.role = token.role as string;
    (session.user as any).onboardingCompleted = token.onboardingCompleted as boolean;
  }
  return session;
},
```

- [ ] **Step 3: 提交**

```bash
git add "src/app/(dashboard)/layout.tsx" src/lib/auth-options.ts
git commit -m "feat: integrate TourProvider into dashboard layout and extend session with onboarding state"
```

---

### Task 14: 端到端验证

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 验证首次登录欢迎弹窗**

1. 在数据库中将测试用户的 `onboardingCompleted` 设为 `false`
2. 登录系统
3. 确认出现欢迎弹窗
4. 点击"跳过"确认弹窗关闭且数据库字段更新为 true

- [ ] **Step 3: 验证完整 Tour 流程**

1. 重置 `onboardingCompleted` 为 false
2. 登录，点击"开始引导"
3. 验证每一步高亮正确、气泡内容正确
4. 验证步骤 5→6 跳转到 /generate 页面后 Tour 继续
5. 验证步骤 10 完成弹窗显示
6. 验证完成后数据库标记为 true

- [ ] **Step 4: 验证手动重入口**

1. 点击 Header "?" 按钮确认 Tour 重新开始
2. 点击 Sidebar "新手引导" 链接确认 Tour 重新开始
3. Tour 进行中点击入口确认按钮 disabled

- [ ] **Step 5: 运行类型检查**

```bash
npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 6: 运行 lint**

```bash
npm run lint
```

Expected: 无错误

---

### Task 15: 最终提交

- [ ] **Step 1: 确认所有更改已提交**

```bash
git status
```

Expected: 无未提交更改

- [ ] **Step 2: 确认 git log 完整**

```bash
git log --oneline -10
```

Expected: 看到所有 onboarding 相关的 commit
