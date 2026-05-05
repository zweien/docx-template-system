# Issue 154: 功能体验打磨 — 搜索、快捷键、批量操作、导出

## 概述

完善系统功能细节，提升日常操作效率。包含四个子功能：命令面板（整合全局搜索）、快捷键体系、批量操作、导出优化。

## Part 1: 命令面板 + 全局搜索增强

### 1.1 命令面板（Command Palette）

**入口**: `Ctrl/Cmd + K`（保持不变）

**三种模式**:

1. **搜索模式**（默认）— 输入关键词
   - 数据源：数据表记录、模板、文档记录、文档收集任务、报告模板
   - 每个数据源独立分组显示，每组最多 5 条结果
   - 点击结果跳转对应详情页

2. **命令模式** — 输入 `>` 前缀
   - 全局导航命令：`> 模板管理`、`> 数据表`、`> 文档记录`、`> 文档收集`、`> 报告`、`> 设置`
   - 页面级命令：根据当前页面上下文显示（`> 新建模板`、`> 导出 Excel`、`> 导入数据` 等）
   - 每个命令右侧显示关联快捷键（如有）

3. **最近搜索** — 无输入时显示
   - 最近 10 条搜索词，存储在 localStorage
   - 可逐条删除或清除全部

### 1.2 技术实现

**前端**:
- 使用 cmdk（已有 `src/components/ui/command.tsx`）重构 `src/components/data/global-search-dialog.tsx`
- 新文件：`src/components/layout/command-palette.tsx`
- 命令注册机制：`src/hooks/use-commands.ts`（自定义 Hook，收集当前页面可用命令）

**后端搜索 API**:
- 扩展 `GET /api/search?q=xxx` 为多数据源搜索
- 扩展 `src/lib/services/search.service.ts` 新增搜索函数：
  - `searchTemplates(query)` — 搜模板名称/描述/标签
  - `searchRecords(query)` — 搜文档记录（文件名/模板名）
  - `searchCollectionTasks(query)` — 搜文档收集任务（标题/描述）
  - `searchReportTemplates(query)` — 搜报告模板（名称/描述）
- 保留现有 `globalSearch()` 搜数据表记录
- 统一返回格式：`{ templates: [], records: [], dataRecords: [], collectionTasks: [], reportTemplates: [] }`

**搜索结果类型**:
```typescript
interface UnifiedSearchResult {
  templates: TemplateSearchItem[];
  records: RecordSearchItem[];
  dataRecords: SearchTableResult[];      // 现有
  collectionTasks: CollectionTaskSearchItem[];
  reportTemplates: ReportTemplateSearchItem[];
}

interface TemplateSearchItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  categoryName: string | null;
}

interface RecordSearchItem {
  id: string;
  fileName: string | null;
  templateName: string;
  status: string;
  createdAt: string;
}

interface CollectionTaskSearchItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
}

interface ReportTemplateSearchItem {
  id: string;
  name: string;
  description: string | null;
}
```

## Part 2: 快捷键体系

### 2.1 全局导航快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl/Cmd + K` | 打开命令面板 |
| `Ctrl/Cmd + 1` | 跳转模板管理 (`/templates`) |
| `Ctrl/Cmd + 2` | 跳转数据表 (`/data`) |
| `Ctrl/Cmd + 3` | 跳转文档记录 (`/records`) |
| `Ctrl/Cmd + 4` | 跳转文档收集 (`/collections`) |
| `Ctrl/Cmd + 5` | 跳转报告 (`/reports`) |
| `Ctrl/Cmd + /` | 显示快捷键帮助 |

### 2.2 实现方式

- 在 `src/components/layout/header.tsx` 中绑定全局快捷键（扩展现有 Ctrl+K 绑定位置）
- 导航快捷键通过 `router.push()` 实现
- 输入框/文本域中不触发快捷键（现有 `isTypingElement` 检测逻辑）
- 快捷键帮助对话框：扩展现有 `keyboard-shortcuts-dialog.tsx`，增加全局快捷键部分

## Part 3: 批量操作

### 3.1 通用批量操作组件

从现有 `src/components/data/batch-action-bar.tsx` 抽取通用版本：
- `src/components/shared/batch-action-bar.tsx` — 通用批量操作栏
- Props 支持自定义操作按钮配置

```typescript
interface BatchAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
}

interface SharedBatchActionBarProps {
  selectedCount: number;
  actions: BatchAction[];
  onClearSelection: () => void;
}
```

### 3.2 各页面批量操作

**模板列表页** (`src/app/(dashboard)/templates/page.tsx`):
- 保持 Server Component 做数据获取，新增 Client Component wrapper 管理批量选择状态
- 批量操作：删除、更改状态（发布/归档/草稿）、更改分类、导出
- 后端 API：`POST /api/templates/batch` 支持 `{ action: "delete" | "updateStatus" | "updateCategory", ids: string[], payload?: {...} }`

**文档记录列表页** (`src/app/(dashboard)/records/page.tsx`):
- 同上，Server Component + Client Component wrapper
- 批量操作：删除、重新生成、导出（ZIP 下载）
- 后端 API：`POST /api/records/batch` 支持 `{ action: "delete" | "regenerate" | "export", ids: string[] }`

**数据表列表页**:
- 在现有导出功能基础上增加"导出选中"选项
- 已有批量操作（删除、编辑），增加"导出选中"按钮

### 3.3 列表页批量选择模式

三个列表页统一的选择模式：
- 表头 Checkbox：全选/取消全选（当前页）
- 行 Checkbox：单选
- 底部浮动批量操作栏：选中后自动显示
- 权限：普通用户只能操作自己的记录，管理员可操作所有

## Part 4: 导出体验优化

### 4.1 选中记录导出（数据表）

- 在批量操作栏中增加"导出选中"按钮
- 支持 Excel 和 JSON 格式
- 扩展 `src/lib/services/export.service.ts`，增加 `selectedIds` 参数

### 4.2 列表页导出

三个列表页的工具栏中增加导出按钮（DropdownMenu）：

**模板列表导出**:
- 导出为 Excel：模板名称、状态、分类、标签、创建者、创建时间
- API：`GET /api/templates/export`

**文档记录列表导出**:
- 导出为 Excel：文档名、模板名、状态、创建者、创建时间
- API：`GET /api/records/export`

**数据表列表导出**:
- 在现有导出下拉菜单中增加"导出选中"选项

### 4.3 后端实现

- 复用/扩展 `src/lib/services/export.service.ts`
- 新增 `exportTemplates()` 和 `exportRecords()` 函数
- 选中导出：在现有导出函数中增加 ID 过滤逻辑
- Excel 生成使用现有 ExcelJS 依赖

## 文件变更预估

### 新增文件
- `src/components/layout/command-palette.tsx` — 命令面板组件
- `src/hooks/use-commands.ts` — 命令注册 Hook
- `src/components/shared/batch-action-bar.tsx` — 通用批量操作栏
- `src/app/api/templates/batch/route.ts` — 模板批量操作 API
- `src/app/api/records/batch/route.ts` — 记录批量操作 API
- `src/app/api/templates/export/route.ts` — 模板导出 API
- `src/app/api/records/export/route.ts` — 记录导出 API

### 修改文件
- `src/components/layout/header.tsx` — 绑定全局快捷键、引用命令面板
- `src/lib/services/search.service.ts` — 扩展多数据源搜索
- `src/app/api/search/route.ts` — 返回统一搜索结果
- `src/components/data/batch-action-bar.tsx` — 可选：重构为通用版本或保留
- `src/app/(dashboard)/templates/page.tsx` — 增加批量选择/导出
- `src/app/(dashboard)/records/page.tsx` — 增加批量选择/导出
- `src/lib/services/export.service.ts` — 增加模板/记录导出 + 选中导出
- `src/components/data/views/grid-view.tsx` — 批量操作栏增加导出
