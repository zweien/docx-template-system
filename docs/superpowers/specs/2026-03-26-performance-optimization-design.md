# 性能优化设计文档

## 背景

当前系统在数据量较大（> 1000 条记录/表）时响应较慢，影响用户体验。需要在以下场景优化：
- 数据表记录列表（加载、筛选、排序）
- 表单填写（选择数据、自动填充）
- 文档生成

## 目标

- 响应时间：页面加载/操作 < 1 秒
- 用户体验：添加加载状态、骨架屏
- 并发能力：支持多用户同时操作

## 优化方案：分层渐进式

分三个阶段实施，每阶段独立可交付。

---

## 阶段 1：数据库层优化

### 目标
将列表查询响应时间降低 50%+

### 1.1 添加 JSONB 索引

```sql
-- 为 data 字段添加 GIN 索引，加速 JSONB 查询
CREATE INDEX idx_data_record_data_gin ON "DataRecord" USING GIN (data);

-- 为常用查询路径添加复合索引
CREATE INDEX idx_data_record_table_created ON "DataRecord" (table_id, created_at DESC);
```

### 1.2 优化 listRecords 查询

**当前问题**：
- 串行查询：getTable → findMany + count → 关联查询
- 内存排序：加载全部数据后在 JS 中排序

**优化后**：
- 合并表定义查询
- 使用数据库排序替代内存排序
- 使用 `findMany` 的 `orderBy` 配合 JSONB 路径排序

```typescript
// 数据库级排序（对于简单类型）
orderBy: {
  data: {
    path: [fieldKey],
    sort: order
  }
}
```

### 1.3 优化关联字段查询

**当前**：每个关联表单独查询

**优化**：合并所有关联表 ID，一次性 IN 查询

```typescript
// 收集所有关联 ID
const allRelationIds = collectRelationIds(records, relationFields);

// 一次性查询所有关联记录
const relatedRecords = await db.dataRecord.findMany({
  where: { id: { in: allRelationIds } }
});
```

### 文件改动
- `prisma/schema.prisma` - 添加索引定义
- `src/lib/services/data-record.service.ts` - 优化查询逻辑

### 预期收益
- 列表加载时间：↓ 50-70%
- 关联字段解析：↓ 40%

---

## 阶段 2：前端体验优化

### 目标
让用户"感觉"更快，即使数据加载需要时间

### 2.1 骨架屏组件

为以下场景添加骨架屏：
- 数据表记录列表
- 模板列表
- 数据选择对话框

```tsx
// components/ui/skeleton.tsx
export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
```

### 2.2 乐观更新

删除/编辑记录时立即更新 UI：

```typescript
// 删除记录
const handleDelete = async (id: string) => {
  // 1. 立即从 UI 移除
  setRecords(prev => prev.filter(r => r.id !== id));

  try {
    await fetch(`/api/records/${id}`, { method: 'DELETE' });
    toast.success('删除成功');
  } catch (error) {
    // 2. 失败时恢复
    setRecords(prev => [...prev, deletedRecord]);
    toast.error('删除失败');
  }
};
```

### 2.3 搜索防抖

```typescript
// 使用 lodash.debounce 或自定义 hook
const debouncedSearch = useDebouncedCallback((value) => {
  setSearch(value);
}, 300);
```

### 2.4 组件优化

- 使用 `React.memo` 避免不必要的重渲染
- 使用 `useMemo` 缓存计算结果
- 虚拟滚动（如数据量 > 50 条）

### 文件改动
- `src/components/ui/skeleton.tsx` - 新增骨架屏组件
- `src/components/data/record-table.tsx` - 添加骨架屏、乐观更新
- `src/components/forms/data-picker-dialog.tsx` - 添加骨架屏
- `src/hooks/use-debounce.ts` - 防抖 hook

### 预期收益
- 用户感知等待时间：↓ 60%
- 不必要的 API 调用：↓ 30%

---

## 阶段 3：缓存层（可选）

### 目标
二次访问接近即时，减少服务器压力

### 3.1 服务端缓存

使用内存缓存（无需 Redis）：

```typescript
// lib/cache.ts
const cache = new Map<string, { data: unknown; expires: number }>();

export function withCache<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expires) {
    return Promise.resolve(cached.data as T);
  }

  return fn().then(data => {
    cache.set(key, { data, expires: Date.now() + ttl });
    return data;
  });
}

// 使用示例：缓存表定义
const table = await withCache(`table:${tableId}`, 300000, () =>
  db.dataTable.findUnique({ where: { id: tableId }, include: { fields: true } })
);
```

缓存策略：
- 表定义：TTL 5 分钟
- 关联字段解析结果：TTL 1 分钟

### 3.2 前端缓存（SWR）

使用 `swr` 库：

```typescript
// hooks/use-data-table.ts
import useSWR from 'swr';

export function useDataTable(tableId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/data-tables/${tableId}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  return { data, error, isLoading, mutate };
}
```

### 3.3 增量更新

```typescript
// 乐观更新 + 后台同步
const handleUpdate = async (record: Record) => {
  // 1. 立即更新本地数据
  mutate(
    data.map(r => r.id === record.id ? record : r),
    false // 不立即重新验证
  );

  // 2. 后台保存
  await fetch(`/api/records/${record.id}`, {
    method: 'PUT',
    body: JSON.stringify(record)
  });

  // 3. 重新验证
  mutate();
};
```

### 文件改动
- `src/lib/cache.ts` - 新增缓存工具
- `src/lib/services/*.ts` - 使用缓存
- `src/hooks/use-data-table.ts` - SWR hook
- `package.json` - 添加 swr 依赖

### 预期收益
- 二次访问响应：↓ 80-90%
- 服务器负载：↓ 50%

---

## 实施计划

| 阶段 | 预计时间 | 优先级 | 依赖 |
|------|---------|--------|------|
| 阶段 1 | 1-2 天 | 高 | 无 |
| 阶段 2 | 2-3 天 | 高 | 无 |
| 阶段 3 | 3-5 天 | 中 | 阶段 2 |

建议先完成阶段 1+2，观察效果后再决定是否实施阶段 3。

## 风险与回滚

- 每个阶段独立，可单独回滚
- 索引添加是安全的，不影响现有功能
- 前端优化可逐个组件实施
