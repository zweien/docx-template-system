# 数据表格滚动与分页优化

> **Goal:** 解决表格横向滚动条在页面最下方不便操作、向下滚动时表头消失、缺少分页页码信息三个体验问题。

## 背景

当前 GridView 使用 shadcn `Table` 组件（`src/components/ui/table.tsx`），外层 div 仅设置 `overflow-x-auto`。当行数超过屏幕高度时：
- 用户需要滚到页面底部才能操作横向滚动条
- 滚动后表头消失，无法识别列含义
- 分页仅显示"上一页/下一页"按钮，缺少总数和页码信息

## 方案：CSS sticky 表头

选择单一 `<table>` + CSS `position: sticky` 方案，保持列宽自然对齐，改动最小。

### 1. 表头固定 + 表格体独立滚动

**改动文件：**
- `src/components/data/views/grid-view.tsx` — 表格渲染
- `src/components/data/record-table.tsx` — 整体布局

**实现：**

1. **不修改全局 `Table` 组件**（`table.tsx`），避免影响其他使用者。在 `grid-view.tsx` 中用外层 div 覆盖 `overflow` 行为
2. `record-table.tsx` 中 GridView 区域改为 flex 布局：`flex flex-col flex-1 min-h-0`，让表格容器自动占满剩余空间（而非硬编码 `calc(100vh - 220px)`）
3. `grid-view.tsx` 中 `<Table>` 外层容器设 `overflow-auto flex-1 min-h-0`，表格体在 flex 容器内独立滚动
4. `<thead>` 内 `<TableRow>` 加 `sticky top-0 z-10` + `bg-background`（完全不透明的主背景色），确保滚动时表头固定且不透出下方内容
5. 分组行（groupBy 分组头）加 `sticky`，`top` 值等于表头行高度。**多分组行堆叠策略：** 只固定最近的一个分组头（当前分组），不堆叠多个分组头（避免占用过多可视空间）。如果分组折叠则 `top` 值回到表头高度

### 2. 分页信息展示

**改动文件：** `src/components/data/record-table.tsx`

**布局：** 底部栏左右分布
- **左侧：** `共 {total} 条，第 {page}/{totalPages} 页`
- **右侧：** 上一页 / 下一页按钮

**行为：**
- 始终显示分页栏（不再仅在 `totalPages > 1` 时显示）
- 1 页时显示 "共 X 条，第 1/1 页"，翻页按钮 disabled

### 不做的事

- 不添加顶部滚动条（sticky 表头已解决横向滚动条可达性问题）
- 不添加页码跳转输入框（YAGNI）
- 不添加每页条数选择器（YAGNI）
- 不改动 Kanban/Gallery/Timeline 视图的滚动行为
