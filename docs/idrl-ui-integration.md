# IDRL 设计系统集成指南

> 本指南用于在新的 Next.js 项目中快速集成 IDRL 设计系统

## 源文件位置

设计系统源码位于:
```
/home/z/test-hub/docx-template-system/packages/idrl-ui/
```

## 快速开始

### 步骤 1: 复制设计系统包

```bash
# 在新项目目录下执行
mkdir -p packages
cp -r /home/z/test-hub/docx-template-system/packages/idrl-ui packages/
```

### 步骤 2: 安装依赖

```bash
# 安装设计系统需要的依赖
pnpm add class-variance-authority clsx tailwind-merge @base-ui/react
```

### 步骤 3: 配置 tsconfig.json

在 `tsconfig.json` 的 `paths` 中添加:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@idrl/ui": ["./packages/idrl-ui/src/index.ts"],
      "@idrl/ui/*": ["./packages/idrl-ui/src/*"]
    }
  }
}
```

### 步骤 4: 配置 CSS (关键步骤)

有两种方式:

#### 方式 A: 嵌入 @theme 到 globals.css (推荐)

在 `src/app/globals.css` 中添加设计 tokens:

```css
@import "tailwindcss";

@theme {
  /* 主色调 - 蓝色系 */
  --color-primary-50: #EFF6FF;
  --color-primary-100: #DBEAFE;
  --color-primary-500: #3B82F6;
  --color-primary-600: #2563EB;
  --color-primary-700: #1D4ED8;
  --color-primary-900: #1E3A8A;

  /* 中性色 */
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
```

#### 方式 B: 从包中导入 tokens.css

在 `src/app/globals.css` 中:

```css
@import "tailwindcss";
@import "@idrl/ui/styles/tokens.css";
```

(确保 Next.js 配置了 resolve aliases 指向 CSS 文件)

### 步骤 5: 在组件中使用

```tsx
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Input, Badge, PageContainer } from "@idrl/ui"

export default function Home() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>标题</CardTitle>
            <CardDescription>描述文字</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="请输入..." />
            <Button variant="primary">主要按钮</Button>
            <Badge variant="success">标签</Badge>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
```

## 组件清单

### UI 组件

| 组件 | 用法 | 参数 |
|------|------|------|
| `Button` | `<Button variant="primary" size="md">` | variant: primary / secondary / outline / ghost / danger; size: sm / md / lg |
| `Card` | `<Card>` | - |
| `CardHeader` | `<CardHeader>` | - |
| `CardTitle` | `<CardTitle>` | - |
| `CardDescription` | `<CardDescription>` | - |
| `CardContent` | `<CardContent>` | - |
| `Input` | `<Input placeholder="..." disabled />` | placeholder, disabled |
| `Badge` | `<Badge variant="primary">` | variant: default / primary / success / warning / destructive |

### 布局组件

| 组件 | 用法 | 参数 |
|------|------|------|
| `PageContainer` | `<PageContainer>` | children |
| `Header` | `<Header><HeaderTitle>标题</HeaderTitle></Header>` | children, className |
| `HeaderTitle` | `<HeaderTitle>` | children, className |
| `Sidebar` | `<Sidebar items={[]} collapsed={false} />` | items: { label, href, icon }[], collapsed |

### 工具函数

| 函数 | 用法 |
|------|------|
| `cn(...)` | 合并 className，与 tailwind-merge 配合使用 |

## 验证

运行项目后访问页面，确认以下内容:

- [ ] 按钮颜色为蓝色 (#2563EB)
- [ ] 圆角为 8px
- [ ] 间距使用 4/8/16/24 像素网格
- [ ] 字体为 Inter 或 DM Sans