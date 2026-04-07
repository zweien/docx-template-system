# 数据表导出/导入增强设计

## 背景

本系统部署在多地，网络不通。需要将数据表的数据从 A 地导出，在 B 地导入还原。现有的导出仅支持 Excel 格式，缺少适合数据库迁移的结构化格式。需要增加 JSON 和 SQL 导出，并实现从导出文件导入的闭环。

## 范围

- **仅单表扁平数据**，不递归导出关联表
- 关联字段导出记录 ID 值
- 不涉及关系明细导入

---

## 一、导出格式

### 1.1 Excel (.xlsx) — 保持不变

已有实现，从 `import.service.ts` 迁移到 `export.service.ts`。

- 表头 = 字段 label
- 关联字段 = 记录 ID
- MULTISELECT 数组转逗号分隔

### 1.2 JSON (.json) — 新增

包含完整表结构元数据和记录数据。

```json
{
  "version": "1.0",
  "exportedAt": "2026-04-07T10:00:00Z",
  "table": {
    "name": "员工信息",
    "description": "公司员工主数据",
    "icon": "users",
    "businessKeys": ["工号"]
  },
  "fields": [
    {
      "key": "name",
      "label": "姓名",
      "type": "TEXT",
      "required": true,
      "sortOrder": 0,
      "options": null,
      "defaultValue": null
    },
    {
      "key": "department",
      "label": "部门",
      "type": "SELECT",
      "required": false,
      "sortOrder": 1,
      "options": ["技术部", "市场部", "人事部"],
      "defaultValue": null
    }
  ],
  "records": [
    { "name": "张三", "department": "技术部" },
    { "name": "李四", "department": "市场部" }
  ]
}
```

字段定义中，关联类型字段额外包含 `relationTo`（目标表 ID）和 `relationCardinality`。

### 1.3 SQL (.sql) — 新增

PostgreSQL 兼容的 SQL 文件。

```sql
-- 数据表: 员工信息
-- 导出时间: 2026-04-07T10:00:00Z
-- 字段定义: name(TEXT), department(SELECT), age(NUMBER)

INSERT INTO "DataRecord" ("id", "tableId", "data", "sortOrder", "createdAt", "updatedAt") VALUES
('rec_001', 'tbl_xxx', '{"name":"张三","department":"技术部","age":30}', 0, '2026-04-01', '2026-04-01'),
('rec_002', 'tbl_xxx', '{"name":"李四","department":"市场部","age":25}', 1, '2026-04-01', '2026-04-01');
```

- 注释包含字段定义信息
- `data` 列为 JSON 字符串（与数据库实际存储一致）
- `tableId` 使用导出表的原始 ID

---

## 二、API 路由

### 新增路由

| 路由 | 方法 | 权限 | 功能 |
|------|------|------|------|
| `/api/data-tables/[id]/export/json` | GET | 认证 | 下载 JSON 格式 |
| `/api/data-tables/[id]/export/sql` | GET | 认证 | 下载 SQL 格式 |
| `/api/data-tables/[id]/import/json` | POST | ADMIN | 从 JSON 文件导入 |

### 保持不变

| 路由 | 方法 | 权限 | 功能 |
|------|------|------|------|
| `/api/data-tables/[id]/export` | GET | 认证 | Excel 导出（路由保持，逻辑迁移到 export.service.ts） |
| `/api/data-tables/[id]/import` | POST | ADMIN | Excel 导入（不变） |

---

## 三、Service 层

### 3.1 新建 `src/lib/services/export.service.ts`

从 `import.service.ts` 拆出导出逻辑，新建独立文件：

```
export.service.ts
├── getTableExportData(tableId): Promise<ServiceResult<TableExportData>>
│   获取表定义 + 字段 + 全量记录，供所有导出格式复用
├── exportToExcel(tableId): Promise<ServiceResult<Buffer>>
│   从 import.service.ts 迁移
├── exportToJSON(tableId): Promise<ServiceResult<ExportJSON>>
│   生成包含元数据和数据的 JSON 对象
├── exportToSQL(tableId): Promise<ServiceResult<string>>
│   生成 PostgreSQL 兼容的 SQL 字符串
```

### 3.2 修改 `src/lib/services/import.service.ts`

- 删除 `exportToExcel` 函数
- 新增 `importFromJSON(tableId, userId, json, options)` 函数：
  - 校验 JSON 结构（version、fields、records）
  - 将 JSON records 转为 `importData` 可接受的格式
  - 复用 `importData` 执行实际导入，传入 `importContext.businessKeys`

---

## 四、前端改动

### 4.1 导出按钮改为下拉菜单

**`table-card.tsx`** — 表卡片的下拉菜单：
- 原"导出数据"选项改为子菜单：`导出 Excel` / `导出 JSON` / `导出 SQL`
- 点击后通过 `window.open()` 触发下载

**`record-table.tsx`** — 工具栏导出按钮：
- 改为 DropdownMenu，显示三种格式选项

### 4.2 导入向导支持 JSON

**`import-wizard.tsx`** — 上传步骤改动：
- 文件接受类型从 `.xlsx` 扩展为 `.xlsx,.json`
- 上传后根据文件扩展名判断格式
- JSON 格式：前端解析展示摘要（表名、字段数、记录数）
- JSON 导入跳过列映射步骤（key 自动匹配），直接进入选项步骤
- 复用现有的选项步骤和结果步骤

---

## 五、数据流

### 导出流程

```
用户点击"导出 JSON"
  → window.open(/api/data-tables/[id]/export/json)
  → Route Handler: auth() → exportToJSON(tableId)
  → getTableExportData(): 查表定义 + 字段 + 全量记录
  → 构建 JSON 对象
  → 返回 application/json 文件下载
```

### 导入流程

```
用户上传 .json 文件
  → 前端解析 JSON，展示摘要
  → 用户确认去重策略
  → POST /api/data-tables/[id]/import/json（FormData: file + config）
  → 后端校验 JSON 结构
  → 调用 importData() 复用现有导入逻辑
  → 返回 ImportResult
```

---

## 六、文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/services/export.service.ts` | 新建 | 导出服务，包含四种导出函数 |
| `src/lib/services/import.service.ts` | 修改 | 删除 exportToExcel，新增 importFromJSON |
| `src/app/api/data-tables/[id]/export/json/route.ts` | 新建 | JSON 导出 API |
| `src/app/api/data-tables/[id]/export/sql/route.ts` | 新建 | SQL 导出 API |
| `src/app/api/data-tables/[id]/import/json/route.ts` | 新建 | JSON 导入 API |
| `src/components/data/table-card.tsx` | 修改 | 导出改为下拉菜单 |
| `src/components/data/record-table.tsx` | 修改 | 导出按钮改为下拉菜单 |
| `src/components/data/import-wizard.tsx` | 修改 | 支持 JSON 文件上传和导入 |
| `src/validators/data-table.ts` | 修改 | 新增 JSON 导入验证 schema |
