# REST API 开放接口（Token 认证）设计文档

## 概述

为系统提供 REST API 开放接口，允许外部系统通过 API Token 认证后操作系统核心功能。采用分阶段交付，第一阶段包含 Token 管理、数据表 API 和模板/文档生成 API。

## 设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 实现范围 | 分阶段，第一阶段 Token + 数据表 + 模板 | 核心集成场景先行 |
| 权限模型 | Token 继承创建者权限 | 实现简单，复用现有 RBAC |
| 架构方案 | 共享 Service 层 + 独立认证中间件 | 最大化代码复用 |
| Token 存储 | 哈希（认证）+ AES 加密（可再次查看） | 兼顾安全性和可用性 |
| 限流 | 第一版跳过 | 避免 Redis 依赖，后续按需添加 |
| UI 位置 | 设置页新增标签页 | 与现有 MCP 等设置一致 |

## 1. 数据库模型

### ApiToken

```prisma
model ApiToken {
  id              String    @id @default(cuid())
  name            String    @db.VarChar(100)
  tokenHash       String    @unique            // SHA-256(token)，用于认证验证
  tokenEncrypted  String                        // AES 加密的完整 token，用于再次显示
  tokenPrefix     String    @db.VarChar(12)    // "idrl_xxxx" 前缀，UI 展示用
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt       DateTime?
  lastUsedAt      DateTime?
  createdAt       DateTime  @default(now())
  revokedAt       DateTime?

  @@index([tokenHash])
  @@index([userId])
  @@map("api_tokens")
}
```

在 User 模型中添加反向关联：
```prisma
apiTokens ApiToken[]
```

## 2. Token 认证中间件

文件：`src/lib/api-token-auth.ts`

### 核心函数

```typescript
authenticateApiToken(request: Request): Promise<{
  success: true;
  data: { userId: string; role: Role }
} | {
  success: false;
  error: { code: string; message: string }
}>
```

### 认证流程

1. 从 `Authorization: Bearer idrl_xxx` 提取 token
2. SHA-256 哈希 → 查询 ApiToken 表匹配 tokenHash
3. 校验：
   - 未撤销（`revokedAt === null`）
   - 未过期（`expiresAt === null || expiresAt > now`）
   - 关联用户存在且活跃
4. 更新 `lastUsedAt`
5. 返回 `{ userId, role }` —— 查询关联 User 获取 role

### 加密工具

文件：`src/lib/token-crypto.ts`

- `hashToken(token: string): string` — SHA-256 哈希
- `encryptToken(token: string): string` — AES-256-GCM 加密
- `decryptToken(encrypted: string): string` — 解密
- 使用 `API_TOKEN_ENCRYPTION_KEY` 环境变量作为密钥

### proxy.ts 放行

在 `proxy.ts` 中放行 `/api/v1` 前缀路由（不需要 session 认证）：
```typescript
// /api/v1/* 使用 Token 认证，不需要 session
if (pathname.startsWith('/api/v1')) {
  return next(response);
}
```

## 3. API 端点设计

### 3.1 Token 管理 API（Session 认证，`/api/api-tokens`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/api-tokens` | 列出当前用户的 Token |
| POST | `/api/api-tokens` | 创建 Token（返回明文） |
| GET | `/api/api-tokens/:id` | 获取 Token 详情（可解密查看完整 token） |
| DELETE | `/api/api-tokens/:id` | 撤销 Token |

**POST 创建请求体：**
```json
{
  "name": "CRM 集成",
  "expiresIn": 90  // 可选，天数。null 表示永不过期
}
```

**POST 创建响应：**
```json
{
  "id": "clx...",
  "name": "CRM 集成",
  "token": "idrl_xxxxxxxxxxxxxxxxxxxx",
  "tokenPrefix": "idrl_xxxx",
  "expiresAt": "2026-07-09T00:00:00.000Z",
  "createdAt": "2026-04-10T00:00:00.000Z"
}
```

**GET 列表响应：**
```json
{
  "tokens": [
    {
      "id": "clx...",
      "name": "CRM 集成",
      "tokenPrefix": "idrl_xxxx",
      "expiresAt": "2026-07-09T00:00:00.000Z",
      "lastUsedAt": "2026-04-10T12:00:00.000Z",
      "createdAt": "2026-04-10T00:00:00.000Z",
      "isRevoked": false
    }
  ]
}
```

**GET 详情响应（可再次查看完整 token）：**
```json
{
  "id": "clx...",
  "name": "CRM 集成",
  "token": "idrl_xxxxxxxxxxxxxxxxxxxx",
  "tokenPrefix": "idrl_xxxx",
  "expiresAt": "2026-07-09T00:00:00.000Z",
  "lastUsedAt": "2026-04-10T12:00:00.000Z",
  "createdAt": "2026-04-10T00:00:00.000Z",
  "isRevoked": false
}
```

### 3.2 数据表 API（Token 认证，`/api/v1/data-tables`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/data-tables` | 列出数据表 |
| GET | `/api/v1/data-tables/:id` | 获取表结构 |
| GET | `/api/v1/data-tables/:id/records` | 查询记录 |
| POST | `/api/v1/data-tables/:id/records` | 创建记录 |
| PATCH | `/api/v1/data-tables/:id/records/:recordId` | 更新记录 |
| DELETE | `/api/v1/data-tables/:id/records/:recordId` | 删除记录 |

**GET /api/v1/data-tables** 响应：
```json
{
  "data": [
    {
      "id": "clx...",
      "name": "员工信息表",
      "description": "公司员工基本信息",
      "fieldCount": 5,
      "recordCount": 120,
      "createdAt": "2026-04-10T00:00:00.000Z"
    }
  ]
}
```

**GET /api/v1/data-tables/:id** 响应：
```json
{
  "data": {
    "id": "clx...",
    "name": "员工信息表",
    "description": "公司员工基本信息",
    "fields": [
      { "key": "name", "label": "姓名", "type": "TEXT", "required": true },
      { "key": "age", "label": "年龄", "type": "NUMBER" },
      { "key": "department", "label": "部门", "type": "SELECT", "options": ["技术部", "市场部"] }
    ],
    "businessKeys": ["name"],
    "createdAt": "2026-04-10T00:00:00.000Z"
  }
}
```

**GET /api/v1/data-tables/:id/records** 查询参数：
- `page` (默认 1)
- `pageSize` (默认 20，最大 100)
- `search` — 全文搜索
- `sortField` — 排序字段
- `sortOrder` — `asc` 或 `desc`
- `filters` — JSON 编码的筛选条件

**GET records 响应：**
```json
{
  "data": {
    "records": [
      { "id": "clx...", "data": { "name": "张三", "age": 30 }, "createdAt": "..." }
    ],
    "total": 120,
    "page": 1,
    "pageSize": 20,
    "totalPages": 6
  }
}
```

**POST /api/v1/data-tables/:id/records** 请求体：
```json
{
  "data": { "name": "李四", "age": 25, "department": "技术部" }
}
```

**PATCH /api/v1/data-tables/:id/records/:recordId** 请求体：
```json
{
  "data": { "age": 26 }
}
```

**DELETE 响应：**
```json
{ "data": { "deleted": true } }
```

### 3.3 模板与文档生成 API（Token 认证，`/api/v1/templates`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/templates` | 列出已发布模板 |
| GET | `/api/v1/templates/:id` | 获取模板详情 |
| POST | `/api/v1/templates/:id/generate` | 生成文档 |

**GET /api/v1/templates** 响应：
```json
{
  "data": [
    {
      "id": "clx...",
      "name": "劳动合同",
      "description": "标准劳动合同模板",
      "status": "PUBLISHED",
      "createdAt": "2026-04-10T00:00:00.000Z"
    }
  ]
}
```

**GET /api/v1/templates/:id** 响应：
```json
{
  "data": {
    "id": "clx...",
    "name": "劳动合同",
    "description": "标准劳动合同模板",
    "placeholders": [
      { "key": "employee_name", "label": "员工姓名", "type": "TEXT" },
      { "key": "start_date", "label": "入职日期", "type": "TEXT" }
    ],
    "createdAt": "2026-04-10T00:00:00.000Z"
  }
}
```

**POST /api/v1/templates/:id/generate** 请求体：
```json
{
  "formData": {
    "employee_name": "张三",
    "start_date": "2026-04-10"
  }
}
```

**响应：** 直接返回 `.docx` 文件流
- `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `Content-Disposition: attachment; filename="劳动合同_张三.docx"`

### 错误响应格式

所有 v1 API 统一错误格式：
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "无效或过期的 API Token"
  }
}
```

错误码列表：
- `UNAUTHORIZED` (401) — Token 缺失、无效或过期
- `FORBIDDEN` (403) — 权限不足
- `NOT_FOUND` (404) — 资源不存在
- `VALIDATION_ERROR` (400) — 请求参数错误
- `INTERNAL_ERROR` (500) — 服务器内部错误

## 4. Token 管理 UI

### 位置

设置页面（`/settings`）新增 "API Token" 标签页，与 MCP 配置等并列。

### 功能

**Token 列表：**
- 表格列：名称、Token 前缀（`idrl_xxxx...`）、过期时间、最后使用时间、创建时间、状态（活跃/已撤销）
- 操作按钮：
  - "查看 Token" — 弹出对话框显示完整 Token，支持复制
  - "撤销" — 确认后软删除

**创建 Token 对话框：**
- 输入字段：
  - 名称（必填）
  - 过期时间（可选：永不过期 / 30天 / 90天 / 自定义日期）
- 创建成功后弹出显示完整 Token

### 新增文件结构

```
src/app/(dashboard)/settings/
  api-tokens-tab.tsx          # Token 管理标签页组件

src/app/api/api-tokens/
  route.ts                    # GET 列表, POST 创建
  [id]/
    route.ts                  # GET 详情, DELETE 撤销

src/app/api/v1/
  data-tables/
    route.ts                  # GET 列出数据表
    [id]/
      route.ts                # GET 表结构
      records/
        route.ts              # GET 查询, POST 创建
        [recordId]/
          route.ts            # PATCH 更新, DELETE 删除
  templates/
    route.ts                  # GET 列出模板
    [id]/
      route.ts                # GET 模板详情
      generate/
        route.ts              # POST 生成文档

src/lib/
  api-token-auth.ts           # Token 认证中间件
  token-crypto.ts             # 加密/哈希工具
  services/
    api-token.service.ts      # Token CRUD 服务
```

## 5. 实现依赖

- **环境变量：** `API_TOKEN_ENCRYPTION_KEY`（AES-256 密钥，32 字节 hex）
- **Token 格式：** `idrl_` + 32 字节随机 hex = `idrl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **现有服务复用：** `data-table.service.ts`、`data-record.service.ts`、`template.service.ts`、`record.service.ts`

## 6. 后续阶段（不在本次实现）

- 收集任务 API（`/api/v1/collections`）
- 按 Token 限流
- API 使用日志/审计
- Webhook 通知
- API 文档页面（Swagger/OpenAPI）
