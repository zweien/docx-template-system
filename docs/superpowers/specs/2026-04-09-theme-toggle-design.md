# 浅色/暗色主题切换设计

## 背景

Issue #24: 深色主题下部分字体与背景颜色接近，导致文字不可读。系统需要支持浅色和暗色主题切换。

## 现有基础设施

- `next-themes` v0.4.6 已安装，`ThemeProvider` 已包裹应用（class 策略）
- Tailwind CSS 已配置 `darkMode: "class"`
- `globals.css` 已有 `@custom-variant dark`
- shadcn/ui 组件已有大量 `dark:` 样式
- **缺失**：`tokens.css` 无暗色变量、无切换按钮、sidebar 硬编码深色

## 设计

### 1. 暗色 Token 定义

在 `src/app/tokens.css` 的 `@theme` 块之后添加 `.dark` 选择器，覆盖语义色变量：

```css
.dark {
  --color-background: #09090B;
  --color-background-subtle: #18181B;
  --color-card: #18181B;
  --color-card-foreground: #FAFAFA;
  --color-popover: #18181B;
  --color-popover-foreground: #FAFAFA;
  --color-secondary: #27272A;
  --color-secondary-foreground: #FAFAFA;
  --color-muted: #27272A;
  --color-muted-foreground: #A1A1AA;
  --color-accent: #1E293B;
  --color-accent-foreground: #FAFAFA;

  --color-border: #27272A;
  --color-border-hover: #3F3F46;
  --color-input: #27272A;
  --color-ring: #3B82F6;

  --color-foreground: #FAFAFA;
  --color-text-primary: #FAFAFA;
  --color-text-secondary: #A1A1AA;
  --color-text-muted: #71717A;

  --color-destructive: #EF4444;
  --color-destructive-foreground: #FAFAFA;
}
```

功能色（success/warning/error/info）和 primary 蓝色在暗色下保持不变，已有足够对比度。

### 2. 主题切换按钮

在 `src/components/layout/header.tsx` 的 Header 右侧（通知铃铛旁）添加主题切换按钮：

- 使用 lucide-react 图标：`Sun`（浅色）、`Moon`（暗色）、`Monitor`（跟随系统）
- 点击循环切换：浅色 → 暗色 → 跟随系统
- 使用 `next-themes` 的 `useTheme()` hook
- 创建独立组件 `src/components/layout/theme-toggle.tsx`

### 3. Sidebar 保持深色

Sidebar 的硬编码颜色（`bg-zinc-950`、`text-white`、`border-zinc-800` 等）保持不变，不受主题切换影响。

### 4. 组件适配

- `src/app/(dashboard)/layout.tsx`：`main` 的 `bg-zinc-50 dark:bg-zinc-950` 改为 `bg-background`，统一由 token 控制
- 审查页面组件中硬编码的 `bg-zinc-50`、`text-zinc-*` 等，替换为语义 token 或补 `dark:` 前缀
- `idrl-ui-globals.css` 中 `body` 的 `bg-background text-foreground` 已能自动跟随

### 涉及文件

| 文件 | 操作 |
|------|------|
| `src/app/tokens.css` | 添加 `.dark` 暗色变量块 |
| `src/components/layout/theme-toggle.tsx` | 新建主题切换组件 |
| `src/components/layout/header.tsx` | 引入 ThemeToggle |
| `src/app/(dashboard)/layout.tsx` | main 背景色改用 token |
| 页面组件（按需） | 替换硬编码颜色为语义 token |

## 不做的事

- 不修改 Sidebar 主题（保持深色）
- 不添加自定义主题色功能
- 不做主题过渡动画（已有 `disableTransitionOnChange`）
