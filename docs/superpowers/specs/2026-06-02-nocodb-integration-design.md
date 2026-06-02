# NocoDB 集成设计

> 日期：2026-06-02
> 状态：待实施

## 概述

将主数据表系统从自定义实现完全替换为 NocoDB。数据表管理通过 iframe 嵌入 NocoDB UI，模板填充和批量生成通过 NocoDB API 桥接。

## 背景

现有系统有一套完整的自定义数据表（DataTable），包含 21 种字段类型、6 种视图、实时协作、MCP 工具等。维护成本高，且 NocoDB 已在本机部署（`http://localhost:8040`），提供同等甚至更强的能力。

## 目标

1. 用 NocoDB 替代自定义数据表后端
2. 保留模板填充、批量生成等核心流程
3. 保留 MCP 工具支持（接口不变）
4. 保留自动化触发能力
5. 数据表管理页面嵌入 NocoDB UI

## 整体架构

```
┌─────────────────────────────────────────────┐
│              前端 (Next.js)                  │
├──────────────┬──────────────┬───────────────┤
│  模板管理     │  报告填充     │  数据表管理    │
│  (不变)       │  (桥接层)     │  (iframe)     │
│              │              │               │
│              │  data-picker │  ┌─────────┐  │
│              │  cascade     │  │ NocoDB  │  │
│              │  batch-gen   │  │ iframe  │  │
│              │              │  └─────────┘  │
├──────────────┴──────────────┴───────────────┤
│           NocoDB 适配层 (新增)                │
│  src/lib/nocodb/                             │
│  - client.ts   API 客户端                    │
│  - adapter.ts  数据结构映射                   │
│  - field-mapper.ts  字段类型转换              │
├─────────────────────────────────────────────┤
│           NocoDB API (localhost:8040)        │
│           REST v2: Data API + Meta API       │
├─────────────────────────────────────────────┤
│           MCP Server (改造)                  │
│  docx-data tools → 调 NocoDB API            │
└─────────────────────────────────────────────┘
```

## 新增模块：NocoDB 适配层

位置：`src/lib/nocodb/`

### 1. `client.ts` — API 客户端

封装 NocoDB v2 REST API 调用：

- 配置：`NOCODB_URL`、`NOCODB_API_TOKEN`、`NOCODB_BASE_ID`（环境变量）
- 认证：`xc-token` header
- 方法：GET / POST / PATCH / DELETE
- 错误处理：统一错误类型，重试（429 rate limit）
- 基础 URL：`${NOCODB_URL}/api/v2`

### 2. `adapter.ts` — 数据结构映射

将 NocoDB 响应映射为现有系统使用的类型：

| 适配方法 | NocoDB API | 返回类型 |
|---------|-----------|---------|
| `listTables()` | `GET /meta/bases/{baseId}/tables` | `DataTableListItem[]` |
| `getTableSchema(tableId)` | `GET /meta/tables/{tableId}` | `DataTableDetail` |
| `listRecords(tableId, params)` | `GET /tables/{tableId}/records` | `PaginatedRecords` |
| `getRecord(tableId, recordId)` | `GET /tables/{tableId}/records/{recordId}` | `DataRecordItem` |
| `createRecord(tableId, data)` | `POST /tables/{tableId}/records` | `DataRecordItem` |
| `updateRecord(tableId, recordId, data)` | `PATCH /tables/{tableId}/records/{recordId}` | `DataRecordItem` |
| `deleteRecord(tableId, recordId)` | `DELETE /tables/{tableId}/records/{recordId}` | `void` |
| `findRecords(tableId, field, value)` | `GET /tables/{tableId}/records?where=(field,eq,value)` | `DataRecordItem[]` |

### 3. `field-mapper.ts` — 字段类型映射

NocoDB → 系统内部类型：

| NocoDB 类型 | 内部类型 |
|------------|---------|
| SingleLineText / LongText | TEXT |
| Number | NUMBER |
| Date / DateTime | DATE |
| Email | EMAIL |
| PhoneNumber | PHONE |
| Url | URL |
| Checkbox | BOOLEAN |
| SingleSelect | SELECT |
| MultiSelect | MULTISELECT |
| Links (mm/o2m/m2m) | RELATION |
| Rollup | ROLLUP |
| Formula | FORMULA |
| Attachment | FILE |
| AutoNumber | AUTO_NUMBER |
| CreatedAt / UpdatedAt | SYSTEM_TIMESTAMP |
| CreatedBy / UpdatedBy | SYSTEM_USER |
| Rating | RATING |
| Currency | CURRENCY |
| Percent | PERCENTAGE |
| Duration | DURATION |

### 4. `filter-mapper.ts` — 过滤器转换

将现有系统的 `FilterCondition` 转为 NocoDB where 语法：

```
{ field: "name", operator: "eq", value: "test" }
→ "(name,eq,test)"
```

支持逻辑组合：`~and`、`~or`、`~not`。

## 前端变更

### 数据表管理页 `/data`

改为 iframe 嵌入 NocoDB：

- 顶部工具栏：显示连接状态（NocoDB URL、连接正常/异常）
- 主体：`<iframe src="${NOCODB_URL}" />` 全屏嵌入
- 自动登录：通过 URL token 参数或 cookie 传递认证信息
- 响应式：iframe 自适应页面大小

### 移除的页面和组件

以下页面/组件不再需要（NocoDB 自带）：

- `src/app/(dashboard)/data/[tableId]/page.tsx` — 表详情
- `src/app/(dashboard)/data/[tableId]/fields/page.tsx` — 字段配置
- `src/app/(dashboard)/data/[tableId]/import/page.tsx` — 导入
- `src/app/(dashboard)/data/[tableId]/new/page.tsx` — 新建记录
- `src/app/(dashboard)/data/[tableId]/[recordId]/edit/page.tsx` — 编辑记录
- `src/components/data/views/` — 所有视图组件（grid/kanban/gallery/timeline/calendar/form）
- `src/components/data/create-table-dialog.tsx`
- `src/components/data/import-table-dialog.tsx`
- `src/components/data/record-table.tsx`
- `src/components/data/table-detail-content.tsx`
- `src/components/data/table-card.tsx`

### 保持不变的页面

- `/templates/[id]/fill` — 模板填充（数据来源改为 NocoDB API）
- `/templates/[id]/batch` — 批量生成（数据来源改为 NocoDB API）
- `/reports/*` — 报告撰写（不变）

### 改动的组件

| 组件 | 变更 |
|------|------|
| `data-picker-dialog.tsx` | API 调用改为 NocoDB adapter |
| `field-mapping-dialog.tsx` | 读 NocoDB 字段元数据 |
| `data-table-link.tsx` | 列出 NocoDB 表 |
| `dynamic-form.tsx` | picker 调用改为 NocoDB adapter |
| `step1-select-data.tsx`（批量） | 列出 NocoDB 表 + 查询记录 |
| `step2-field-mapping.tsx`（批量） | 读 NocoDB 字段元数据 |

## 后端变更

### API 路由改动

**保留并改造：**

| 路由 | 变更 |
|------|------|
| `/api/placeholders/[id]/picker-data` | 改为调 NocoDB adapter 查数据 |
| `/api/fill/resolve-cascade` | 改为调 NocoDB adapter 解析关联 |
| `/api/records` | formData 来源不变（前端提交） |
| `/api/records/[id]/generate` | 不变 |

**移除（数据表管理由 NocoDB 接管）：**

| 路由 | 原因 |
|------|------|
| `/api/data-tables/`（主 API） | 数据表 CRUD 由 NocoDB 管理 |
| `/api/data-tables/[id]/fields` | NocoDB 自带 |
| `/api/data-tables/[id]/records` | NocoDB 自带 |
| `/api/data-tables/[id]/views` | NocoDB 自带 |
| `/api/data-tables/[id]/import` | NocoDB 自带 |
| `/api/data-tables/[id]/export` | NocoDB 自带 |
| `/api/v1/data-tables/` | 被 NocoDB adapter 替代 |

**保留（v1 API 路由改为代理到 NocoDB）：**

v1 API 路由可选择保留作为兼容层，内部代理到 NocoDB adapter。或直接移除，因为 MCP Server 直接调 NocoDB。

### Service 层变更

**移除的 Service：**

- `data-table.service.ts` — 表 CRUD（NocoDB 接管）
- `data-field.service.ts` — 字段管理（NocoDB 接管）
- `data-record.service.ts` — 记录 CRUD（NocoDB 接管）
- `data-relation.service.ts` — 关联管理（NocoDB 接管）
- `data-view.service.ts` — 视图管理（NocoDB 接管）

**保留的 Service：**

- `template.service.ts` — 模板管理
- `placeholder.service.ts` — Placeholder 管理（dataTableId 改存 NocoDB tableId）
- `record.service.ts` — 文档生成记录
- `batch-generation.service.ts` — 批量生成（数据来源改调 NocoDB adapter）

### Prisma Schema 变更

**保留模型（不变）：**

- `Template` — `dataTableId` 字段改为存 NocoDB tableId 字符串
- `Placeholder` — `sourceTableId` 改为存 NocoDB tableId，`sourceField` 改为存 NocoDB field name
- `Record` — 文档生成记录
- 其他模板、用户、自动化相关模型

**移除模型：**

- `DataTable`
- `DataField`
- `DataRecord`
- `DataView`
- `DataRelationRow`
- `DataRecordChangeHistory`
- `DataRecordComment`

移除时机：确保所有引用这些模型的代码都已替换后执行 `prisma db push`。

## MCP Server 改造

位置：`mcp-server/`

### 改造策略

10 个工具的 JSON Schema 接口保持不变，底层实现替换。

| MCP 工具 | NocoDB API 对应 |
|----------|----------------|
| `list_tables` | `GET /api/v2/meta/bases/{baseId}/tables` + 字段映射 |
| `get_table_schema` | `GET /api/v2/meta/tables/{tableId}` + 类型映射 |
| `list_records` | `GET /api/v2/tables/{tableId}/records` + 过滤器转换 |
| `create_record` | `POST /api/v2/tables/{tableId}/records` |
| `update_record` | `PATCH /api/v2/tables/{tableId}/records/{recordId}` |
| `delete_record` | `DELETE /api/v2/tables/{tableId}/records/{recordId}` |
| `find_or_create` | 先 `GET` + where filter，未找到则 `POST` |
| `upsert_record` | 先 `GET` + where filter，找到则 `PATCH`，否则 `POST` |
| `batch_create` | `POST /api/v2/tables/{tableId}/records` 批量模式 |
| `link_records` | `POST /api/v2/tables/{tableId}/links/{fieldId}/records/{recordId}` |

### 配置变更

```env
# 旧配置（移除）
API_BASE_URL=http://localhost:8060
API_TOKEN=xxx

# 新配置
NOCODB_URL=http://localhost:8040
NOCODB_API_TOKEN=xxx
NOCODB_BASE_ID=xxx
```

### 改造文件

- `mcp-server/src/api-client.ts` — 完全重写，改为 NocoDB API 客户端
- `mcp-server/src/index.ts` — 工具实现改为调新 api-client

## 自动化触发

现有自动化引擎在记录创建/更新/删除时触发动作。改为 NocoDB 后：

**方案：NocoDB Webhooks**

1. 在 NocoDB 表上配置 Webhook（当记录创建/更新/删除时触发）
2. Webhook 调用本系统的 API endpoint
3. 本系统执行对应的自动化动作

涉及的 API：
- NocoDB: `POST /api/v2/meta/tables/{tableId}/webhooks` — 创建 Webhook
- 本系统: 新增 `/api/automation/nocodb-webhook` — 接收 Webhook 回调

## 环境变量

```env
# NocoDB 集成
NOCODB_URL=http://localhost:8040
NOCODB_API_TOKEN=xxx        # 从 NocoDB 个人设置获取
NOCODB_BASE_ID=xxx          # 项目/BASE ID（如 pxxxxxxxxx）

# 可选：功能开关
NOCODB_ENABLED=true         # 是否启用 NocoDB 模式（默认 true）
```

## 实施顺序

1. **Phase 1 — 基础适配层**：新增 `src/lib/nocodb/`，实现 client + adapter + field-mapper
2. **Phase 2 — 前端改造**：数据表页面改为 iframe，改造 picker/mapping 组件
3. **Phase 3 — 后端改造**：API 路由改调 adapter，移除旧 service
4. **Phase 4 — MCP Server**：改造 api-client 和工具实现
5. **Phase 5 — 清理**：移除旧 Prisma 模型、旧组件、旧 API 路由
6. **Phase 6 — 自动化 Webhook**：对接 NocoDB Webhooks

## 风险和缓解

| 风险 | 缓解措施 |
|------|---------|
| NocoDB API 限流（5 req/s） | 客户端侧实现请求队列和缓存 |
| iframe 跨域限制 | NocoDB 同机部署，无跨域问题 |
| NocoDB 字段类型不完全匹配 | field-mapper 做降级映射，不支持的类型映射为 TEXT |
| 数据迁移（如果需要迁移现有数据） | 本方案不迁移，NocoDB 从空开始 |
| NocoDB 服务不可用 | 健康检查 + 降级提示 |
