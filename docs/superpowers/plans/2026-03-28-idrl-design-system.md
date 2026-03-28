# IDRL 设计系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建可复用的 UI 组件库 `@idrl/ui`，确保 IDRL 内部各系统保持一致的视觉风格和交互体验

**Architecture:**
- 独立包 `@idrl/ui` 位于 `packages/idrl-ui/`
- 基于 @base-ui/react (shadcn/ui v4) 定制化配置
- 组件源码直接保留在本项目中，便于定制和版本控制
- 使用 monorepo 方式管理，与主应用共享依赖

**Tech Stack:** Next.js 16, Tailwind CSS v4, @base-ui/react, Lucide Icons

---

## 文件结构规划

创建以下文件结构：

```
packages/
  idrl-ui/
    src/
      components/
        ui/
          button.tsx       # 复制自 src/components/ui/button.tsx
          card.tsx         # 复制自 src/components/ui/card.tsx
          input.tsx        # 复制自 src/components/ui/input.tsx
          badge.tsx        # 复制自 src/components/ui/badge.tsx
        layout/
          sidebar.tsx      # 复制自 src/components/layout/sidebar.tsx
          header.tsx       # 复制自 src/components/layout/header.tsx
          page-container.tsx
      styles/
        tokens.css         # Design tokens CSS 变量
        globals.css        # 基础全局样式
      index.ts             # 统一导出
      utils.ts             # cn 工具函数（复制）
    package.json
    tailwind.config.ts
    tsconfig.json
```

---

## Task 1: 创建包基础结构

**Files:**
- Create: `packages/idrl-ui/package.json`
- Create: `packages/idrl-ui/tsconfig.json`
- Create: `packages/idrl-ui/tailwind.config.ts`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p packages/idrl-ui/src/components/ui
mkdir -p packages/idrl-ui/src/components/layout
mkdir -p packages/idrl-ui/src/styles
```

- [ ] **Step 2: 创建 package.json**

```json
{
  "name": "@idrl/ui",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./styles/*": "./src/styles/*"
  },
  "scripts": {
    "type-check": "tsc --noEmit"
  },
  "peerDependencies": {
    "@base-ui/react": ">=1.0.0",
    "react": "^18 || ^19",
    "react-dom": "^18 || ^19",
    "tailwindcss": "^4.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "lucide-react": ">=0.400.0"
  },
  "devDependencies": {
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5"
  }
}
```

> **Note:** 主项目已有 `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` 依赖，idrl-ui 作为本地包复用这些依赖

- [ ] **Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 4: 创建 tailwind.config.ts**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          50: "var(--color-primary-50)",
          100: "var(--color-primary-100)",
          500: "var(--color-primary-500)",
          600: "var(--color-primary-600)",
          700: "var(--color-primary-700)",
          900: "var(--color-primary-900)",
        },
        neutral: {
          50: "var(--color-neutral-50)",
          100: "var(--color-neutral-100)",
          200: "var(--color-neutral-200)",
          300: "var(--color-neutral-300)",
          400: "var(--color-neutral-400)",
          500: "var(--color-neutral-500)",
          600: "var(--color-neutral-600)",
          700: "var(--color-neutral-700)",
          800: "var(--color-neutral-800)",
          900: "var(--color-neutral-900)",
        },
        border: "var(--color-border)",
        "border-hover": "var(--color-border-hover)",
        background: "var(--color-background)",
        "background-subtle": "var(--color-background-subtle)",
        foreground: "var(--color-text-primary)",
        "foreground-secondary": "var(--color-text-secondary)",
        "foreground-muted": "var(--color-text-muted)",
        primary: "var(--color-primary-600)",
        "primary-foreground": "#ffffff",
        secondary: "var(--color-neutral-100)",
        "secondary-foreground": "var(--color-neutral-700)",
        muted: "var(--color-neutral-100)",
        "muted-foreground": "var(--color-neutral-600)",
        destructive: "var(--color-error)",
        "destructive-foreground": "#ffffff",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        info: "var(--color-info)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
      },
      spacing: {
        xs: "var(--spacing-xs)",
        sm: "var(--spacing-sm)",
        md: "var(--spacing-md)",
        lg: "var(--spacing-lg)",
        xl: "var(--spacing-xl)",
        "2xl": "var(--spacing-2xl)",
      },
    },
  },
};

export default config;
```

- [ ] **Step 5: 提交**

```bash
git add packages/idrl-ui/
git commit -m "feat(ui): create idrl-ui package structure"
```

---

## Task 2: 创建 Design Tokens

**Files:**
- Create: `packages/idrl-ui/src/styles/tokens.css`
- Modify: `packages/idrl-ui/tailwind.config.ts`

- [ ] **Step 1: 创建 tokens.css**

```css
@theme {
  /* 主色调 - 蓝色系 */
  --color-primary-50: #EFF6FF;
  --color-primary-100: #DBEAFE;
  --color-primary-500: #3B82F6;
  --color-primary-600: #2563EB;
  --color-primary-700: #1D4ED8;
  --color-primary-900: #1E3A8A;

  /* 中性色 */
  --color-background: #FFFFFF;
  --color-background-subtle: #F8FAFC;
  --color-neutral-50: #FAFAFA;
  --color-neutral-100: #F5F5F5;
  --color-neutral-200: #E5E5E5;
  --color-neutral-300: #D4D4D4;
  --color-neutral-400: #A3A3A3;
  --color-neutral-500: #737373;
  --color-neutral-600: #525252;
  --color-neutral-700: #404040;
  --color-neutral-800: #262626;
  --color-neutral-900: #171717;
  --color-border: #E2E8F0;
  --color-border-hover: #CBD5E1;

  /* 文本色 */
  --color-text-primary: #0F172A;
  --color-text-secondary: #475569;
  --color-text-muted: #94A3B8;

  /* 功能色 */
  --color-success: #16A34A;
  --color-warning: #D97706;
  --color-error: #DC2626;
  --color-info: #0284C7;

  /* 间距 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;

  /* 圆角 */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* 字体 */
  --font-sans: "Inter", "DM Sans", system-ui, -apple-system, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;
}

/* 移动端适配 */
@media (max-width: 640px) {
  :root {
    --spacing-md: 12px;
    --spacing-lg: 16px;
    --spacing-xl: 24px;
  }
}
```

- [ ] **Step 2: 简化 tailwind.config.ts（Tailwind v4 使用 CSS @theme）**

由于 Tailwind v4 支持直接在 CSS 中使用 @theme，可以简化配置：

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
};

export default config;
```

- [ ] **Step 3: 创建 globals.css**

```css
@import "./tokens.css";

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground font-sans;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add packages/idrl-ui/src/styles/
git commit -m "feat(ui): add design tokens CSS"
```

---

## Task 3: 复制基础 UI 组件

**Files:**
- Create: `packages/idrl-ui/src/lib/utils.ts`
- Create: `packages/idrl-ui/src/components/ui/button.tsx`
- Create: `packages/idrl-ui/src/components/ui/card.tsx`
- Create: `packages/idrl-ui/src/components/ui/input.tsx`
- Create: `packages/idrl-ui/src/components/ui/badge.tsx`

- [ ] **Step 1: 复制 utils.ts**

从 `src/lib/utils.ts` 复制到 `packages/idrl-ui/src/lib/utils.ts`

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 2: 复制 button.tsx 并适配**

从 `src/components/ui/button.tsx` 复制，根据规范调整：
- 尺寸：sm (32px→h-8), md (36px→h-9), lg (40px→h-10)
- 变体统一使用 neutral 颜色

```tsx
"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import React from "react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary-600 text-white hover:bg-primary-700",
        secondary: "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
        outline: "border border-neutral-200 text-neutral-700 hover:bg-neutral-50",
        ghost: "text-neutral-700 hover:bg-neutral-100",
        danger: "bg-red-600 text-white hover:bg-red-700",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-9 px-4",
        lg: "h-10 px-5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

function Button({
  className,
  variant = "primary",
  size = "md",
  render,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      className={cn(buttonVariants({ variant, size, className }))}
      render={render}
      {...props}
    />
  )
}

export { Button, buttonVariants }
```

- [ ] **Step 3: 复制 card.tsx 并适配**

```tsx
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl border border-neutral-200/60 bg-white shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-4", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-neutral-500", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

export { Card, CardHeader, CardTitle, CardDescription, CardContent }
```

- [ ] **Step 4: 复制 input.tsx 并适配**

```tsx
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border-0 bg-neutral-50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
```

- [ ] **Step 5: 复制 badge.tsx 并适配**

```tsx
"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-neutral-100 text-neutral-600",
        primary: "bg-primary-50 text-primary-700",
        success: "bg-green-100 text-green-700",
        warning: "bg-amber-100 text-amber-700",
        destructive: "bg-red-100 text-red-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
```

- [ ] **Step 6: 安装依赖**

```bash
# 在主项目中安装 base-ui（如果还没有）
npm install @base-ui/react class-variance-authority clsx tailwind-merge
```

- [ ] **Step 7: 提交**

```bash
git add packages/idrl-ui/src/
git commit -m "feat(ui): add basic UI components (Button, Card, Input, Badge)"
```

---

## Task 4: 创建布局组件

**Files:**
- Create: `packages/idrl-ui/src/components/layout/page-container.tsx`
- Create: `packages/idrl-ui/src/components/layout/header.tsx`
- Create: `packages/idrl-ui/src/components/layout/sidebar.tsx`

- [ ] **Step 1: 创建 page-container.tsx**

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

function PageContainer({ children, className, ...props }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto max-w-7xl px-6 py-8",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { PageContainer }
```

- [ ] **Step 2: 创建 header.tsx（基于现有 src/components/layout/header.tsx）**

```tsx
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface HeaderProps extends React.HTMLAttributes<HTMLHeaderElement> {
  children?: React.ReactNode
}

function Header({ children, className, ...props }: HeaderProps) {
  return (
    <header
      className={cn(
        "flex h-14 items-center border-b border-neutral-100 bg-white px-6",
        className
      )}
      {...props}
    >
      {children}
    </header>
  )
}

interface HeaderTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

function HeaderTitle({ className, ...props }: HeaderTitleProps) {
  return (
    <h1
      className={cn("text-2xl font-semibold", className)}
      {...props}
    />
  )
}

export { Header, HeaderTitle }
```

- [ ] **Step 3: 创建 sidebar.tsx（基于现有 src/components/layout/sidebar.tsx）**

```tsx
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface NavItem {
  title: string
  href: string
  icon: LucideIcon
}

interface SidebarProps extends React.HTMLAttributes<HTMLaside> {
  navItems: NavItem[]
}

function Sidebar({ navItems, className, ...props }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "flex w-64 flex-col bg-neutral-900 text-white",
        className
      )}
      {...props}
    >
      {/* Logo 区域 */}
      <div className="flex h-14 items-center px-4">
        <span className="text-lg font-semibold">IDRL填表系统</span>
      </div>

      {/* 导航项 */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

export { Sidebar }
```

- [ ] **Step 4: 更新 index.ts 导出**

```typescript
// Layout Components
export { PageContainer } from "./components/layout/page-container"
export { Header, HeaderTitle } from "./components/layout/header"
export { Sidebar } from "./components/layout/sidebar"
```

- [ ] **Step 5: 提交**

```bash
git add packages/idrl-ui/src/components/layout/
git commit -m "feat(ui): add layout components (Header, Sidebar, PageContainer)"
```

---

## Task 5: 创建统一导出

**Files:**
- Create: `packages/idrl-ui/src/index.ts`

- [ ] **Step 1: 创建 index.ts**

```typescript
// UI Components
export { Button, buttonVariants } from "./components/ui/button"
export { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./components/ui/card"
export { Input } from "./components/ui/input"
export { Badge, badgeVariants } from "./components/ui/badge"

// Layout Components
export { PageContainer } from "./components/layout/page-container"
export { Header, HeaderTitle } from "./components/layout/header"
export { Sidebar } from "./components/layout/sidebar"

// Utils
export { cn } from "./lib/utils"
```

- [ ] **Step 2: 创建 lib 目录并提交**

```bash
git add packages/idrl-ui/src/index.ts
git commit -m "feat(ui): add unified exports"
```

---

## Task 6: 集成到主应用

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: 修改 globals.css 导入设计 tokens**

在 `src/app/globals.css` 顶部添加：

```css
@import "@idrl/ui/styles/tokens.css";
@import "@idrl/ui/styles/globals.css";
```

- [ ] **Step 2: 配置 TypeScript 路径别名**

在主项目 `tsconfig.json` 中添加路径映射：

```json
{
  "compilerOptions": {
    "paths": {
      "@idrl/ui": ["./packages/idrl-ui/src/index.ts"]
    }
  }
}
```

> 注：由于采用 monorepo 目录结构（packages/idrl-ui 与 src 平级），使用 paths 直接映射。无需 workspace 协议。

- [ ] **Step 3: 测试组件导入**

创建测试页面验证组件可用：

```tsx
import { Button, Card, Input, Badge, PageContainer } from "@idrl/ui"

export default function TestPage() {
  return (
    <PageContainer>
      <Card>
        <CardHeader>
          <CardTitle>测试卡片</CardTitle>
          <CardDescription>这是一个测试描述</CardDescription>
        </CardHeader>
        <CardContent>
          <Input placeholder="请输入..." />
          <Badge variant="primary">标签</Badge>
        </CardContent>
      </Card>
      <Button variant="primary">主要按钮</Button>
      <Button variant="secondary">次要按钮</Button>
    </PageContainer>
  )
}
```

- [ ] **Step 4: 提交**

```bash
git add src/app/globals.css tsconfig.json
git commit -m "feat(ui): integrate idrl-ui into main application"
```

---

## Task 7: 验证与调整

**Files:**
- Test: 所有 idrl-ui 组件

- [ ] **Step 1: 运行 TypeScript 类型检查**

```bash
cd packages/idrl-ui && npx tsc --noEmit
```

- [ ] **Step 2: 启动开发服务器验证 UI**

```bash
npm run dev
```

访问测试页面，确认组件样式符合规范

- [ ] **Step 3: 根据实际情况调整**

根据验证结果调整组件样式，确保与设计规范一致

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat(ui): complete idrl-ui design system v1.0"
```