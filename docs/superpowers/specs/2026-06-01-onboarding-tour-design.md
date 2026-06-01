# 新用户引导 Tour 设计

## 概述

为新用户提供分步式页面导引，帮助快速了解系统界面和核心操作流程。首次登录弹窗询问是否开始引导，用户也可通过侧边栏或 Header 手动重新进入。

## 技术方案

**使用 Driver.js**（轻量零依赖 Tour 库，MIT 许可），封装为 React hooks 和 Provider 使用。

## 数据模型

User 表新增两个字段：

```prisma
model User {
  onboardingCompleted Boolean @default(false)
  onboardingVersion   Int    @default(1)
}
```

- `onboardingCompleted` — 是否完成过引导（完成或跳过均为 true）
- `onboardingVersion` — 引导内容版本号，将来内容更新时递增可对老用户重新触发

## API

- `PATCH /api/user/onboarding` — 标记引导完成/跳过，body: `{ completed: boolean }`
- 复用现有用户服务模式（ServiceResult 返回值）

## 引导步骤（共 10 步）

### 阶段一：界面介绍（步骤 1-5）

| 步骤 | 高亮目标 | 标题 | 说明 |
|------|----------|------|------|
| 1 | 居中弹窗 | 欢迎使用 | 全屏遮罩弹窗，介绍系统定位，"开始引导"/"跳过" |
| 2 | `#sidebar-nav` | 侧边栏导航 | 介绍导航分组：模板与表单、数据中心、报告中心 |
| 3 | `#header-search` | 搜索与快捷键 | 介绍 ⌘K 全局搜索和快捷导航 |
| 4 | `#quick-actions` | 首页概览 | 介绍快捷操作、待办事项、最近使用 |
| 5 | `#user-nav` | 用户菜单 | 介绍主题切换、通知、个人设置 |

### 阶段二：核心流程（步骤 6-10）

| 步骤 | 高亮目标 | 标题 | 说明 |
|------|----------|------|------|
| 6 | `#template-list` | 模板库 | 跳转 /generate，介绍如何浏览和选择模板 |
| 7 | `#form-area` | 填写表单 | 介绍动态表单和各类字段填写方式 |
| 8 | `#submit-btn` | 生成文档 | 介绍文档生成和预览流程 |
| 9 | `#records-page` | 记录与下载 | 跳转 /records，介绍历史记录查看和文档下载 |
| 10 | 居中弹窗 | 引导完成 | 总结要点，提示重入口位置 |

步骤 5→6 之间通过 `router.push('/generate')` 跳转页面，Driver.js 在新页面自动恢复。步骤 8→9 同理跳转到 /records（在步骤 8 的 `onNextClick` 中调用 `router.push('/records')`，新页面 mount 后 TourProvider 恢复到步骤 9）。

## 组件架构

```
src/
├── components/onboarding/
│   ├── tour-provider.tsx      # TourProvider 上下文
│   ├── welcome-dialog.tsx     # 首次登录欢迎弹窗
│   ├── tour-completion.tsx    # 引导完成总结弹窗
│   ├── tour-steps.ts          # 步骤定义（selector、标题、描述）
│   └── use-tour.ts           # Hook：启动/停止/控制
├── app/api/user/onboarding/
│   └── route.ts              # PATCH 标记引导完成
```

### 依赖关系

```
dashboard/layout.tsx
  └── TourProvider（包裹 children）
        ├── 读取 onboardingCompleted 状态
        ├── 条件渲染 WelcomeDialog
        └── 提供 useTour() hook
              ├── Header → "?" 按钮
              └── Sidebar → "新手引导" 链接
```

### 状态管理（Zustand）

```typescript
interface TourState {
  isActive: boolean;
  currentStep: number;
  start: () => void;
  stop: () => void;
  markCompleted: () => void;
}
```

状态不持久化到数据库——刷新页面后 Tour 停止，`onboardingCompleted` 仅在 Tour 完成/跳过时写入。

## UI 设计

### 欢迎弹窗

- 全屏半透明遮罩（backdrop-blur）
- 居中 Dialog，最大宽度 420px
- 使用项目 Dialog 组件
- "开始引导"主按钮 + "跳过，稍后再看"次按钮
- Esc 可关闭（等同于跳过），点击遮罩不可关闭

### Tour 气泡

- Driver.js 默认深色主题，通过 CSS 变量覆盖匹配项目主题
- 顶部：步骤计数（"步骤 2 / 10"）+ 关闭按钮
- 中部：标题 + 说明文字
- 底部：上一步 / 进度圆点 / 下一步
- 关闭按钮 = 中途退出，标记 onboardingCompleted = true

### 完成弹窗

- 与欢迎弹窗同样的居中 Dialog
- 简要总结，提示重入口位置
- 单个"开始使用"按钮

### 手动重入口

- **Header**：搜索栏和主题切换之间添加 `?` 图标按钮（使用 HelpCircle 图标），hover tooltip "新手引导"
- **Sidebar**：底部"关于"链接下方新增"新手引导"链接（GraduationCap 图标）
- 点击直接启动 Tour，从第 1 步开始
- Tour 进行中入口按钮 disabled

## 跨页面处理

Driver.js 不原生支持路由切换。通过步骤定义中的 `onNextClick` 回调实现：

```typescript
{
  element: '#quick-actions',
  popover: {
    title: '快速操作',
    description: '...',
    onNextClick: () => router.push('/generate'),
  },
}
```

TourProvider 监听路由变化，在新页面 mount 后恢复 Driver.js 实例并跳转到对应步骤。

## 主题适配

使用 CSS 变量覆盖 Driver.js 样式，适配深色/浅色模式：

```css
.driver-active .driver-popover {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border);
}
```

## 元素 ID 约定

需要在现有组件上添加稳定的 `id` 属性供 Driver.js 定位：

- `sidebar-nav` — 侧边栏导航区域
- `header-search` — Header 搜索框
- `quick-actions` — 首页快速操作卡片
- `user-nav` — Header 右侧用户导航
- `template-list` — /generate 模板选择区
- `form-area` — 表单填写区
- `submit-btn` — 提交生成按钮
- `records-page` — /records 页面主内容区

## 持久化

- `onboardingCompleted` — 存数据库，跨设备同步
- Tour 进行中状态 — 不持久化，刷新即停止
