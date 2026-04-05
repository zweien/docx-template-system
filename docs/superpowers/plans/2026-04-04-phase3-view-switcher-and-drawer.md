# Phase 3: 视图切换器 + 记录详情抽屉 + 页面集成

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建视图类型切换器组件（Grid/Kanban/Gallery/Timeline）、共享记录详情抽屉组件，并将它们集成到 table-detail-content 页面中。

**Architecture:** 视图切换器在页面顶部工具栏中，位于视图选择器旁边，允许用户在不同视图类型之间切换。记录详情抽屉（Sheet 组件）从右侧滑出，所有视图共用。table-detail-content 重构为协调器，管理全局状态并传递给当前激活的视图。

**Tech Stack:** React 19, shadcn/ui v4 Sheet (Base UI Dialog), lucide-react icons

**Depends on:** Phase 1 (数据模型 + hooks)

---

## File Structure

```
src/components/data/
  view-switcher.tsx                    # CREATE: view type switcher (tabs)
  record-detail-drawer.tsx             # CREATE: shared record detail drawer
  table-detail-content.tsx             # MODIFY: integrate view switcher + drawer
  record-table.tsx                     # MODIFY: receive external props from parent
```

---

### Task 16: 创建视图切换器组件

**Files:**
- Create: `src/components/data/view-switcher.tsx`

- [ ] **Step 1: 创建视图类型切换器**

```typescript
"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LayoutGrid, Columns3, GalleryHorizontal, GanttChart } from "lucide-react";
import type { ViewType } from "@/types/data-table";

interface ViewSwitcherProps {
  currentType: ViewType;
  onTypeChange: (type: ViewType) => void;
}

const VIEW_TYPES: { type: ViewType; icon: typeof Columns3; label: string }[] = [
  { type: "GRID", icon: Columns3, label: "表格" },
  { type: "KANBAN", icon: LayoutGrid, label: "看板" },
  { type: "GALLERY", icon: GalleryHorizontal, label: "画廊" },
  { type: "TIMELINE", icon: GanttChart, label: "时间线" },
];

export function ViewSwitcher({ currentType, onTypeChange }: ViewSwitcherProps) {
  return (
    <div className="flex items-center gap-0.5 border rounded-md p-0.5">
      {VIEW_TYPES.map(({ type, icon: Icon, label }) => (
        <Tooltip key={type}>
          <TooltipTrigger
            render={
              <Button
                variant={currentType === type ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => onTypeChange(type)}
              />
            }
          >
            <Icon className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/data/view-switcher.tsx
git commit -m "feat(data): add ViewSwitcher component for Grid/Kanban/Gallery/Timeline"
```

---

### Task 17: 创建记录详情抽屉

**Files:**
- Create: `src/components/data/record-detail-drawer.tsx`

- [ ] **Step 1: 创建共享记录详情抽屉**

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { formatCellValue } from "@/lib/format-cell";
import type { DataFieldItem, DataRecordItem } from "@/types/data-table";
import { Pencil, Trash2 } from "lucide-react";

interface RecordDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string | null;
  tableId: string;
  fields: DataFieldItem[];
  records?: DataRecordItem[];           // NEW: 已加载的记录列表，优先从中查找
  isAdmin: boolean;
  onEdit?: () => void;
  onDelete?: (recordId: string) => void;
}

export function RecordDetailDrawer({
  open,
  onOpenChange,
  recordId,
  tableId,
  fields,
  records: cachedRecords,
  isAdmin,
  onEdit,
  onDelete,
}: RecordDetailDrawerProps) {
  const [record, setRecord] = useState<DataRecordItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !recordId) {
      setRecord(null);
      return;
    }

    // 优先从已加载的 records 中查找，避免额外网络请求
    const cached = cachedRecords?.find((r) => r.id === recordId);
    if (cached) {
      setRecord(cached);
      return;
    }

    // 缓存未命中时才 fetch（如分页场景下记录不在当前页）
    let cancelled = false;
    async function fetchRecord() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/data-tables/${tableId}/records/${recordId}`);
        if (!res.ok) return;
        const result = await res.json();
        // API 返回 ServiceResult，record 数据在 result.data 中
        if (!cancelled && result) setRecord(result.data ?? result);
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchRecord();
    return () => { cancelled = true; };
  }, [open, recordId, tableId, cachedRecords]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {record ? `记录详情` : "记录详情"}
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : !record ? (
          <div className="text-center py-8 text-zinc-500">
            记录不存在
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {/* Actions */}
            {isAdmin && (
              <div className="flex gap-2">
                <Link href={`/data/${tableId}/${record.id}/edit`}>
                  <Button variant="outline" size="sm">
                    <Pencil className="h-4 w-4 mr-1" />
                    编辑
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600"
                  onClick={() => {
                    if (onDelete) onDelete(record.id);
                    onOpenChange(false);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  删除
                </Button>
              </div>
            )}

            <Separator />

            {/* Fields */}
            {fields.map((field) => (
              <div key={field.id} className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">
                  {field.label}
                </span>
                <div className="text-sm">
                  {formatCellValue(field, record.data[field.key])}
                </div>
              </div>
            ))}

            {/* Meta info */}
            <Separator />
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <span>创建者: {record.createdByName}</span>
              <span>创建时间: {new Date(record.createdAt).toLocaleString("zh-CN")}</span>
              <span>更新时间: {new Date(record.updatedAt).toLocaleString("zh-CN")}</span>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/data/record-detail-drawer.tsx
git commit -m "feat(data): add RecordDetailDrawer shared component for all views"
```

---

### Task 18: 集成到 table-detail-content

**Files:**
- Modify: `src/components/data/table-detail-content.tsx`
- Modify: `src/components/data/record-table.tsx`

- [ ] **Step 1: 重构 `table-detail-content.tsx`**

将视图切换器和记录详情抽屉集成到页面布局中：

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Bot } from "lucide-react";
import { RecordTable } from "@/components/data/record-table";
import { ViewSwitcher } from "@/components/data/view-switcher";
import { RecordDetailDrawer } from "@/components/data/record-detail-drawer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DataTableDetail, ViewType } from "@/types/data-table";

interface TableDetailContentProps {
  tableId: string;
  table: DataTableDetail;
  isAdmin: boolean;
}

export function TableDetailContent({ tableId, table, isAdmin }: TableDetailContentProps) {
  const [viewType, setViewType] = useState<ViewType>("GRID");
  const [detailRecordId, setDetailRecordId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleOpenDetail = (recordId: string) => {
    setDetailRecordId(recordId);
    setDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setDetailRecordId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1">
            <Link href="/data" className="hover:underline">主数据</Link>
            <span>/</span>
            <span>{table.name}</span>
          </div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {table.icon && <span>{table.icon}</span>}
            {table.name}
          </h1>
          {table.description && (
            <p className="text-zinc-500 mt-1">{table.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/ai-agent?tableId=${tableId}`}>
            <Button variant="outline" size="sm">
              <Bot className="h-4 w-4 mr-2" />
              AI 助手
            </Button>
          </Link>

          {isAdmin && (
            <>
              <Link href={`/data/${tableId}/import`}>
                <Button variant="outline" size="sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" x2="12" y1="3" y2="15" />
                  </svg>
                  导入
                </Button>
              </Link>
              <Link href={`/data/${tableId}/fields`}>
                <Button variant="outline" size="sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <line x1="3" x2="21" y1="9" y2="9" />
                    <line x1="9" x2="9" y1="21" y2="9" />
                  </svg>
                  配置字段
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1 text-zinc-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <line x1="3" x2="21" y1="9" y2="9" />
            <line x1="9" x2="9" y1="21" y2="9" />
          </svg>
          {table.fieldCount} 个字段
        </div>
        <div className="flex items-center gap-1 text-zinc-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="M18 17V9" />
            <path d="M13 17V5" />
            <path d="M8 17v-3" />
          </svg>
          {table.recordCount} 条记录
        </div>
      </div>

      <Separator />

      {/* View Switcher + Record Table */}
      <div className="space-y-4">
        <ViewSwitcher currentType={viewType} onTypeChange={setViewType} />
        <RecordTable
          tableId={tableId}
          fields={table.fields}
          isAdmin={isAdmin}
          viewType={viewType}
          onOpenDetail={handleOpenDetail}
        />
      </div>

      {/* Record Detail Drawer */}
      <RecordDetailDrawer
        open={detailOpen}
        onOpenChange={handleCloseDetail}
        recordId={detailRecordId}
        tableId={tableId}
        fields={table.fields}
        isAdmin={isAdmin}
        onDelete={(recordId) => {
          handleCloseDetail();
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: 更新 `record-table.tsx` 接受新 props**

在 `RecordTable` 的 props 中添加：

```typescript
interface RecordTableProps {
  tableId: string;
  fields: DataFieldItem[];
  isAdmin: boolean;
  viewType: ViewType;                    // NEW
  onOpenDetail: (recordId: string) => void; // NEW
}
```

根据 `viewType` 选择渲染哪个视图组件：

```typescript
export function RecordTable({ tableId, fields, isAdmin, viewType, onOpenDetail }: RecordTableProps) {
  const tableData = useTableData({ tableId, fields });

  // 根据 viewType 渲染不同的视图
  switch (viewType) {
    case "KANBAN":
      // Phase 4 实现
      return <div className="text-center py-8 text-zinc-500">看板视图（即将支持）</div>;
    case "GALLERY":
      // Phase 4 实现
      return <div className="text-center py-8 text-zinc-500">画廊视图（即将支持）</div>;
    case "TIMELINE":
      // Phase 4 实现
      return <div className="text-center py-8 text-zinc-500">时间线视图（即将支持）</div>;
    case "GRID":
    default:
      return (
        <GridRecordTable
          tableId={tableId}
          fields={fields}
          isAdmin={isAdmin}
          tableData={tableData}
          onOpenDetail={onOpenDetail}
        />
      );
  }
}
```

`GridRecordTable` 完整接口（从当前 `RecordTable` 的渲染逻辑提取）：

```typescript
interface GridRecordTableProps {
  tableId: string;
  fields: DataFieldItem[];
  isAdmin: boolean;
  tableData: UseTableDataReturn;              // 来自 useTableData hook
  onOpenDetail: (recordId: string) => void;   // 打开记录详情抽屉
}

function GridRecordTable({ tableId, fields, isAdmin, tableData, onOpenDetail }: GridRecordTableProps) {
  // 解构 tableData
  const {
    records, totalCount, totalPages, isLoading,
    page, setPage, search, searchInput, setSearchInput,
    viewId, currentConfig, setFilters, setSorts,
    setVisibleFields, setFieldOrder, deleteRecord, deletingIds,
    switchView, refreshViews, refresh,
  } = tableData;

  // ... 当前 RecordTable 中的所有渲染逻辑（Toolbar + Table + Pagination + SaveViewDialog）
  // 唯一区别：行点击事件改为调用 onOpenDetail(record.id) 而非跳转编辑页
}
```

- [ ] **Step 3: 运行类型检查**

Run: `npx tsc --noEmit`

- [ ] **Step 4: 手动测试**

Run: `npm run dev`

测试步骤：
1. 打开数据表详情页
2. 确认视图切换器显示（Grid/Kanban/Gallery/Timeline）
3. 切换到 Kanban/Gallery/Timeline，确认显示"即将支持"占位
4. 切换回 Grid，确认表格正常显示
5. 点击记录行，确认详情抽屉从右侧滑出

- [ ] **Step 5: Commit**

```bash
git add src/components/data/table-detail-content.tsx src/components/data/record-table.tsx
git commit -m "feat(data): integrate ViewSwitcher and RecordDetailDrawer into table detail page"
```

---

## Summary

Phase 3 完成后：

- 视图切换器组件支持 Grid/Kanban/Gallery/Timeline 四种视图类型
- 记录详情抽屉组件从右侧滑出，所有视图共用
- table-detail-content 作为协调器管理全局状态
- Grid 视图正常运行，其他视图显示占位符

下一步：Phase 4（看板、画廊、时间线视图实现）
