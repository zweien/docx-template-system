# IDRL 设计系统规范

**Version:** 1.0
**Date:** 2026-03-28
**Status:** Draft

## 1. 概述

### 1.1 目标

创建可复用的 UI 组件库，确保 IDRL 内部各系统保持一致的视觉风格和交互体验。

### 1.2 范围

- Design Tokens（颜色、字体、间距、圆角等）
- 基础 React 组件（Button、Card、Input、Badge 等）
- 布局组件（Sidebar、Header、Page Layout）
- shadcn/ui 定制配置（基于现有组件定制，与上游更新解耦）

**与现有 shadcn/ui 的关系：**
- 复用 shadcn/ui 源码，定制化配置
- 组件源码保留在本项目 `packages/idrl-ui/src/components/ui/`，便于定制和版本控制
- 不依赖 npm 包更新，与上游 shadcn/ui 解耦

### 1.3 技术栈

- Next.js 16+ (App Router)
- Tailwind CSS v4
- shadcn/ui v4 (Base UI)
- Lucide Icons

---

## 2. Design Tokens

### 2.1 颜色系统

```css
/* 主色调 - 蓝色系（统一使用层级命名） */
--color-primary-50: #EFF6FF;
--color-primary-100: #DBEAFE;
--color-primary-500: #3B82F6;
--color-primary-600: #2563EB;
--color-primary-700: #1D4ED8;
--color-primary-900: #1E3A8A;

/* 中性色 - 统一使用 neutral 替代 gray */
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
```

### 2.2 字体

- 主字体：Inter / DM Sans（中文优先系统字体）
- 代码字体：Geist Mono

### 2.3 间距系统

```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
--spacing-2xl: 48px;

/* 移动端适配 - 使用 rem 单位 */
@media (max-width: 640px) {
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
}
```

### 2.4 圆角

```css
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-full: 9999px;
```

---

## 3. 组件规范

### 3.1 Button

- 尺寸：sm (32px), md (36px), lg (40px)
- 变体：
  - **primary**: bg-primary-600, text-white, hover:bg-primary-700
  - **secondary**: bg-neutral-100, text-neutral-700, hover:bg-neutral-200
  - **outline**: border border-neutral-200, text-neutral-700, hover:bg-neutral-50
  - **ghost**: text-neutral-700, hover:bg-neutral-100
  - **danger**: bg-red-600, text-white, hover:bg-red-700
- 圆角：rounded-lg (12px)
- 字体：font-medium, text-sm

### 3.2 Card

- 背景：white
- 边框：border border-neutral-200/60
- 圆角：rounded-2xl (16px)
- 阴影：shadow-sm
- Hover：translateY(-2px) + shadow-md

### 3.3 Input

- 高度：40px
- 背景：neutral-50
- 边框：0（默认），focus 时 ring-2 ring-primary/20
- 圆角：rounded-xl

### 3.4 Badge

- 背景：neutral-100（默认）、primary-50（主色）
- 文字：neutral-600（默认）、primary-700（主色）
- 圆角：rounded-full

---

## 4. 布局规范

### 4.1 Sidebar

- 宽度：260px（展开）、72px（收起）
- 背景：neutral-900
- 字体：white
- Logo 区域高度：56px
- 导航项高度：40px
- 间距：px-3 py-2

### 4.2 Header

- 高度：56px
- 背景：white
- 边框：border-b border-neutral-100
- 页面标题：text-2xl font-semibold

### 4.3 Page Container

- 最大宽度：max-w-7xl
- 内边距：px-6 py-8
- 间距：gap-4 或 gap-6

---

## 5. 目录结构

```
packages/
  idrl-ui/
    src/
      components/
        ui/
          button.tsx
          card.tsx
          input.tsx
          badge.tsx
          ...
        layout/
          sidebar.tsx
          header.tsx
          page-container.tsx
      styles/
        globals.css
        tokens.css
      index.ts
    package.json
    tailwind.config.ts
    tsconfig.json
```

---

## 6. 使用方式

### 6.1 安装

```bash
npm install @idrl/ui
```

### 6.2 配置

Tailwind v4 使用 CSS @import 方式导入设计 tokens：

```css
/* 在主应用中引入 */
@import "@idrl/ui/styles/tokens.css";
@import "@idrl/ui/styles/globals.css";
```

或在 `tailwind.config.ts` 中配置 preset（推荐）：

```typescript
// tailwind.config.ts
import idrl from '@idrl/ui/tailwind-config'

export default {
  presets: [idrl],
}
```

> 注：v4 不再使用传统 `plugins` 方式，改为 CSS @import 或 preset 方式。

### 6.3 使用组件

```typescript
import { Button, Card, Input, Badge } from '@idrl/ui'
import { Sidebar, Header, PageContainer } from '@idrl/ui'
```

---

## 7. 实施计划

### Phase 1: 抽离现有组件（2天）

**目标：** 将现有组件抽离为独立包

**具体产出：**
- [ ] 复制 `src/components/ui/` 到 `packages/idrl-ui/src/components/ui/`
- [ ] 复制 `src/components/layout/` 到 `packages/idrl-ui/src/components/layout/`
- [ ] 提取 design tokens 到 `packages/idrl-ui/src/styles/tokens.css`
- [ ] 创建 `packages/idrl-ui/src/index.ts` 统一导出
- [ ] 创建 `packages/idrl-ui/tailwind.config.ts`
- [ ] 创建 `packages/idrl-ui/package.json`

**验收标准：** `packages/idrl-ui` 可独立引入，组件可正常使用

### Phase 2: 标准化（1天）

**目标：** 统一命名规范，完善类型

**具体产出：**
- [ ] 统一颜色变量命名（移除 gray，统一使用 neutral）
- [ ] 完善 TypeScript 类型定义
- [ ] 编写 README.md 文档
- [ ] 添加组件使用示例

**验收标准：** 组件 API 清晰，有完整类型提示

### Phase 3: 发布与集成（1天）

**目标：** 发布并集成到各应用

**具体产出：**
- [ ] 配置 npm scope（@idrl/ui）或配置 monorepo
- [ ] 在本项目中测试集成
- [ ] 验证其他应用可正常使用

**验收标准：** 各应用可通过 npm 或 monorepo 引用 idrl-ui

---

## 8. 待定事项

- [ ] 确定包管理方式（npm/private registry）
- [ ] 确定图标集是否需要扩展
- [ ] 确定是否需要暗色模式支持
- [ ] 确定响应式断点策略