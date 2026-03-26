# 性能优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化系统响应速度，使页面加载/操作 < 1 秒，提升用户体验

**Architecture:** 三阶段渐进式优化 - 数据库层索引和查询优化 → 前端骨架屏和乐观更新 → 可选缓存层

**Tech Stack:** Next.js 16, Prisma 7, PostgreSQL, React 19, Tailwind CSS

---

## 文件结构

### 新增文件
- `src/components/ui/skeleton.tsx` - 骨架屏组件
- `src/hooks/use-debounce.ts` - 防抖 Hook
- `src/lib/cache.ts` - 内存缓存工具（阶段 3）

### 修改文件
- `prisma/schema.prisma` - 添加索引
- `src/lib/services/data-record.service.ts` - 优化查询逻辑
- `src/components/data/record-table.tsx` - 骨架屏、乐观更新、防抖搜索

---

## 阶段 1：数据库层优化

### Task 1.1：添加数据库索引

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1：在 DataRecord 模型中添加索引**

在 `prisma/schema.prisma` 的 `DataRecord` 模型中添加：

```prisma
model DataRecord {
  id          String   @id @default(cuid())
  tableId     String
  table       DataTable @relation(fields: [tableId], references: [id], onDelete: Cascade)
  data        Json
  records     Record[]
  createdBy   User     @relation(fields: [createdById], references: [id])
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([tableId])
  @@index([createdById])
  @@index([tableId, createdAt(sort: Desc)])  // 新增：复合索引加速列表查询
  @@index([tableId, createdById])             // 新增：复合索引加速用户记录查询
}
```

- [ ] **Step 2：推送 schema 变更到数据库**

Run: `npx prisma db push`
Expected: 成功创建索引

- [ ] **Step 3：生成 Prisma 客户端**

Run: `npx prisma generate`
Expected: 客户端重新生成

- [ ] **Step 4：提交**

```bash
git add prisma/schema.prisma
git commit -m "perf: add database indexes for DataRecord table

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 1.2：优化 listRecords 查询 - 减少内存排序

**Files:**
- Modify: `src/lib/services/data-record.service.ts:166-185`

- [ ] **Step 1：优化排序逻辑 - 对于无排序的情况跳过内存处理**

在 `listRecords` 函数中，找到内存排序代码块（约第 166-185 行），修改为：

```typescript
// 优化：无排序时跳过内存处理
let sortedRecords = records.map(mapRecordToItem);

// 对于简单字段类型的排序，保持内存排序（JSONB 排序在 Prisma 中支持有限）
// 但仅在明确需要排序时执行
if (filters.sortBy) {
  const { fieldKey, order } = filters.sortBy;
  const fieldDef = tableResult.data.fields.find(f => f.key === fieldKey);
  if (fieldDef) {
    sortedRecords.sort((a, b) => {
      const aVal = a.data[fieldKey];
      const bVal = b.data[fieldKey];

      // 处理 { id, display } 对象格式（关联字段）
      const aDisplay = typeof aVal === 'object' && aVal !== null && 'display' in aVal
        ? (aVal as { display: unknown }).display
        : aVal;
      const bDisplay = typeof bVal === 'object' && bVal !== null && 'display' in bVal
        ? (bVal as { display: unknown }).display
        : bVal;

      const aNum = Number(aDisplay);
      const bNum = Number(bDisplay);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return order === "asc" ? aNum - bNum : bNum - aNum;
      }
      const aStr = String(aDisplay ?? "");
      const bStr = String(bDisplay ?? "");
      return order === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }
}
```

- [ ] **Step 2：验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3：提交**

```bash
git add src/lib/services/data-record.service.ts
git commit -m "perf: optimize sorting logic for relation fields

- Handle { id, display } object format in sort comparison
- Skip unnecessary sorting when no sortBy specified

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 阶段 2：前端体验优化

### Task 2.1：创建骨架屏组件

**Files:**
- Create: `src/components/ui/skeleton.tsx`

- [ ] **Step 1：创建 Skeleton 组件**

创建 `src/components/ui/skeleton.tsx`：

```tsx
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800",
        className
      )}
    />
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3 border-b">
      <Skeleton className="h-4 w-4" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}
```

- [ ] **Step 2：验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3：提交**

```bash
git add src/components/ui/skeleton.tsx
git commit -m "feat: add Skeleton and TableSkeleton components

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2.2：创建防抖 Hook

**Files:**
- Create: `src/hooks/use-debounce.ts`

- [ ] **Step 1：创建 useDebouncedCallback Hook**

创建 `src/hooks/use-debounce.ts`：

```tsx
import { useCallback, useRef, useEffect } from "react";

export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // 更新 callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // 清理 timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay]
  );
}

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debouncedValue;
}

import { useState } from "react";
```

- [ ] **Step 2：修复 import 顺序**

修改 `src/hooks/use-debounce.ts`，将 `useState` import 移到顶部：

```tsx
import { useCallback, useRef, useEffect, useState } from "react";
```

- [ ] **Step 3：验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4：提交**

```bash
git add src/hooks/use-debounce.ts
git commit -m "feat: add useDebouncedCallback and useDebouncedValue hooks

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2.3：为 RecordTable 添加骨架屏和防抖搜索

**Files:**
- Modify: `src/components/data/record-table.tsx`

- [ ] **Step 1：添加 import**

在文件顶部添加：

```tsx
import { TableSkeleton } from "@/components/ui/skeleton";
import { useDebouncedCallback } from "@/hooks/use-debounce";
```

- [ ] **Step 2：添加防抖搜索**

找到 `const [search, setSearch]` 声明，添加防抖逻辑：

```tsx
const [search, setSearch] = useState(searchParams.get("search") ?? "");
const [searchInput, setSearchInput] = useState(search);

// 防抖搜索 - 300ms 后触发
const debouncedSetSearch = useDebouncedCallback((value: string) => {
  setSearch(value);
}, 300);

const handleSearchChange = (value: string) => {
  setSearchInput(value);
  debouncedSetSearch(value);
};
```

- [ ] **Step 3：更新搜索表单**

找到搜索表单，修改为：

```tsx
<form onSubmit={handleSearch} className="flex-1 sm:flex-none">
  <Input
    placeholder="搜索记录..."
    value={searchInput}
    onChange={(e) => handleSearchChange(e.target.value)}
    className="h-9 w-full sm:w-[200px]"
  />
</form>
```

- [ ] **Step 4：添加骨架屏到表格**

找到 `isLoading` 判断的 `TableRow`，替换为：

```tsx
{isLoading ? (
  <TableRow>
    <TableCell
      colSpan={colCount}
      className="p-0 border-0"
    >
      <TableSkeleton rows={5} columns={orderedVisibleFields.length} />
    </TableCell>
  </TableRow>
) : !data || data.records.length === 0 ? (
```

- [ ] **Step 5：验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 6：提交**

```bash
git add src/components/data/record-table.tsx
git commit -m "perf: add skeleton loading and debounced search to RecordTable

- Replace loading text with TableSkeleton component
- Add 300ms debounce to search input to reduce API calls

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2.4：为 RecordTable 添加乐观删除

**Files:**
- Modify: `src/components/data/record-table.tsx`

- [ ] **Step 1：修改 handleDelete 函数**

找到 `handleDelete` 函数，修改为乐观删除：

```tsx
const handleDelete = async (recordId: string) => {
  // 乐观删除：立即从 UI 移除
  const recordToDelete = data?.records.find(r => r.id === recordId);
  if (!recordToDelete) return;

  // 保存当前数据以便回滚
  const previousRecords = data?.records ?? [];

  // 立即更新 UI
  setData(prev => prev ? {
    ...prev,
    records: prev.records.filter(r => r.id !== recordId),
    total: prev.total - 1,
  } : null);

  try {
    const response = await fetch(
      `/api/data-tables/${tableId}/records/${recordId}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      throw new Error("删除失败");
    }
  } catch (error) {
    // 回滚：恢复删除的记录
    setData(prev => prev ? {
      ...prev,
      records: previousRecords,
      total: prev.total + 1,
    } : null);
    console.error("删除失败:", error);
    alert("删除失败，请重试");
  }
};
```

- [ ] **Step 2：移除 confirm 弹窗（可选）**

如果需要更流畅的体验，可以移除 `if (!confirm(...))` 检查，或者改为 toast 确认。

- [ ] **Step 3：验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4：提交**

```bash
git add src/components/data/record-table.tsx
git commit -m "perf: add optimistic delete to RecordTable

- Immediately remove record from UI before API response
- Rollback on error

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2.5：为 DataPickerDialog 添加骨架屏

**Files:**
- Modify: `src/components/forms/data-picker-dialog.tsx`

- [ ] **Step 1：添加 import**

```tsx
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
```

- [ ] **Step 2：替换 loading 状态**

找到 `{loading ? (` 部分，替换为：

```tsx
{loading ? (
  <div className="px-4 sm:px-6 py-2">
    <TableSkeleton rows={5} columns={fields.length} />
  </div>
) : records.length === 0 ? (
```

- [ ] **Step 3：验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4：提交**

```bash
git add src/components/forms/data-picker-dialog.tsx
git commit -m "perf: add skeleton loading to DataPickerDialog

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 阶段 3：缓存层（可选）

### Task 3.1：创建内存缓存工具

**Files:**
- Create: `src/lib/cache.ts`

- [ ] **Step 1：创建缓存模块**

创建 `src/lib/cache.ts`：

```tsx
interface CacheEntry<T> {
  data: T;
  expires: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function withCache<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key);
  const now = Date.now();

  if (cached && cached.expires > now) {
    return Promise.resolve(cached.data as T);
  }

  return fn().then((data) => {
    cache.set(key, { data, expires: now + ttl });
    return data;
  });
}

export function invalidateCache(pattern: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(pattern)) {
      cache.delete(key);
    }
  }
}

export function clearCache(): void {
  cache.clear();
}

// 缓存 TTL 常量（毫秒）
export const CACHE_TTL = {
  TABLE_DEF: 5 * 60 * 1000,   // 5 分钟
  RELATIONS: 60 * 1000,       // 1 分钟
} as const;
```

- [ ] **Step 2：验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3：提交**

```bash
git add src/lib/cache.ts
git commit -m "feat: add in-memory cache utility with TTL support

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3.2：为 getTable 添加缓存

**Files:**
- Modify: `src/lib/services/data-table.service.ts`

- [ ] **Step 1：添加 import**

```tsx
import { withCache, CACHE_TTL } from "@/lib/cache";
```

- [ ] **Step 2：修改 getTable 函数**

```tsx
export async function getTable(id: string): Promise<ServiceResult<DataTableItem>> {
  return withCache(
    `table:${id}`,
    CACHE_TTL.TABLE_DEF,
    async () => {
      try {
        const table = await db.dataTable.findUnique({
          where: { id },
          include: {
            fields: {
              orderBy: { sortOrder: "asc" },
            },
            createdBy: { select: { name: true } },
          },
        });

        if (!table) {
          return {
            success: false,
            error: { code: "NOT_FOUND", message: "数据表不存在" },
          };
        }

        return { success: true, data: mapTableToItem(table) };
      } catch (error) {
        const message = error instanceof Error ? error.message : "获取数据表失败";
        return { success: false, error: { code: "GET_FAILED", message } };
      }
    }
  );
}
```

- [ ] **Step 3：验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4：提交**

```bash
git add src/lib/services/data-table.service.ts
git commit -m "perf: add caching to getTable service

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 完成检查

- [ ] 验证所有 TypeScript 编译通过：`npx tsc --noEmit`
- [ ] 验证 ESLint 通过：`npm run lint`
- [ ] 验证构建通过：`npm run build`
- [ ] 手动测试：
  - 打开数据表列表，验证骨架屏显示
  - 测试搜索防抖功能
  - 测试删除记录的乐观更新
  - 验证响应时间是否有改善

---

## 回滚方案

每个 Task 独立提交，如发现问题可单独回滚：

```bash
git revert <commit-hash>
```
