# AI Agent2 MCP 集成设计

**日期**: 2026-04-10
**状态**: Draft

## 概述

在 ai-agent2 上集成 Model Context Protocol (MCP) 功能，允许管理员配置外部 MCP 服务器，AI 在对话时可调用这些服务器提供的工具来获取外部数据。

## 需求

- 管理员可在后台配置 MCP 服务器（支持 stdio、sse、http 三种传输方式）
- AI 在对话时自动识别并调用 MCP 工具
- MCP 工具与现有内置工具并行使用，复用确认机制
- 单个 MCP 服务器连接失败不影响整体对话

## 架构

```
管理员后台配置 MCP 服务器
         ↓
存储到 Agent2McpServer 表
         ↓
聊天时，后端读取已启用的 MCP 服务器
         ↓
用 @ai-sdk/mcp createMCPClient 连接各服务器
         ↓
获取 MCP 工具，与内置工具合并
         ↓
AI 自动选择合适的工具（内置或 MCP）
         ↓
MCP 工具执行走现有确认机制
```

## 数据库设计

新增 `Agent2McpServer` 表：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| name | String (@unique) | 服务器名称，同时作为工具前缀标识 |
| description | String? | 服务器描述 |
| transportType | McpTransportType (enum: stdio, sse, http) | 传输方式 |
| config | Json | 连接配置（含 timeout） |
| enabled | Boolean (默认 true) | 是否启用 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

### config JSON 结构

**stdio**:
```json
{
  "command": "node",
  "args": ["server.js"],
  "env": { "API_KEY": "xxx" },
  "timeout": 5000
}
```

**sse**:
```json
{
  "url": "http://localhost:3000/sse",
  "headers": { "Authorization": "Bearer xxx" },
  "timeout": 5000
}
```

**http**:
```json
{
  "url": "http://localhost:3000/mcp",
  "headers": { "Authorization": "Bearer xxx" },
  "timeout": 5000
}
```

`timeout` 字段为连接超时毫秒数，默认 5000。环境变量中的敏感值（env 和 headers 中的值）使用 AES-256-GCM 加密存储，与现有模型配置加密方式一致。

## Prisma Schema 变更

```prisma
enum McpTransportType {
  stdio
  sse
  http
}

model Agent2McpServer {
  id            String            @id @default(cuid())
  name          String            @unique
  description   String?
  transportType McpTransportType
  config        Json
  enabled       Boolean           @default(true)
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
}
```

## API 路由

```
api/agent2/admin/mcp/
├── route.ts              # GET (列表), POST (添加) — 仅管理员
├── [id]/route.ts         # PATCH (更新), DELETE (删除) — 仅管理员
└── [id]/test/route.ts    # POST (连接测试 + 列出工具) — 仅管理员
```

所有接口需检查 `session.user.role === "admin"`。

### 接口详情

**GET /api/agent2/admin/mcp**
- 返回所有 MCP 服务器列表（config 中敏感字段解密后掩码显示）

**POST /api/agent2/admin/mcp**
- Body: `{ name, description?, transportType, config }`
- 校验 name 唯一、config 结构符合 transportType
- 敏感字段加密后存储

**PATCH /api/agent2/admin/mcp/[id]**
- Body: `{ name?, description?, transportType?, config?, enabled? }`
- 更新时重新加密敏感字段

**DELETE /api/agent2/admin/mcp/[id]**
- 直接删除记录

**POST /api/agent2/admin/mcp/[id]/test**
- 创建临时 MCP 客户端连接
- 调用 `listTools()` 获取工具列表
- 返回 `{ success: true, tools: [...] }` 或 `{ success: false, error: "..." }`
- 关闭连接

## 服务层

### 新文件: `src/lib/services/agent2-mcp.service.ts`

遵循现有 ServiceResult 模式：

```typescript
// 主要函数
listMcpServers(): Promise<ServiceResult<Agent2McpServerItem[]>>
createMcpServer(data): Promise<ServiceResult<Agent2McpServerItem>>
updateMcpServer(id, data): Promise<ServiceResult<Agent2McpServerItem>>
deleteMcpServer(id): Promise<ServiceResult<void>>
testMcpServer(id): Promise<ServiceResult<{ tools: McpToolInfo[] }>>
```

### 新文件: `src/lib/agent2/mcp-client.ts`

MCP 客户端管理：

```typescript
// 创建 MCP 客户端连接
createMcpClient(server: Agent2McpServer): Promise<MCPClient>

// 获取所有已启用 MCP 服务器的工具
getEnabledMcpTools(): Promise<{
  tools: Record<string, Tool>
  clients: MCPClient[]
}>
```

## 类型定义

### `src/types/agent2.ts` 新增

```typescript
interface Agent2McpServerItem {
  id: string
  name: string
  description: string | null
  transportType: 'stdio' | 'sse' | 'http'
  config: McpServerConfig
  enabled: boolean
  createdAt: string
  updatedAt: string
}

type McpServerConfig =
  | { type: 'stdio'; command: string; args?: string[]; env?: Record<string, string>; timeout?: number }
  | { type: 'sse'; url: string; headers?: Record<string, string>; timeout?: number }
  | { type: 'http'; url: string; headers?: Record<string, string>; timeout?: number }

interface McpToolInfo {
  name: string
  description?: string
  inputSchema?: object
}
```

## 验证器

### `src/validators/agent2.ts` 新增

```typescript
const createMcpServerSchema = z.discriminatedUnion('transportType', [
  z.object({
    name: z.string().min(1).max(50),
    description: z.string().max(200).optional(),
    transportType: z.literal('stdio'),
    config: z.object({
      command: z.string().min(1),
      args: z.array(z.string()).optional(),
      env: z.record(z.string()).optional(),
      timeout: z.number().min(1000).max(60000).optional(),
    }),
  }),
  z.object({
    name: z.string().min(1).max(50),
    description: z.string().max(200).optional(),
    transportType: z.literal('sse'),
    config: z.object({
      url: z.string().url(),
      headers: z.record(z.string()).optional(),
      timeout: z.number().min(1000).max(60000).optional(),
    }),
  }),
  z.object({
    name: z.string().min(1).max(50),
    description: z.string().max(200).optional(),
    transportType: z.literal('http'),
    config: z.object({
      url: z.string().url(),
      headers: z.record(z.string()).optional(),
      timeout: z.number().min(1000).max(60000).optional(),
    }),
  }),
])
```

## 聊天流程集成

修改 `src/app/api/agent2/conversations/[id]/chat/route.ts`：

```typescript
// 现有流程
const builtInTools = createTools(userId)

// 新增：获取 MCP 工具
const { tools: mcpTools, clients: mcpClients } = await getEnabledMcpTools()

// 合并工具
const allTools = { ...builtInTools, ...mcpTools }

// streamText 使用合并后的工具
streamText({
  model,
  system: systemPrompt,
  messages: truncatedMessages,
  tools: allTools,
  // ...
  onFinish: async () => {
    // 关闭 MCP 连接
    for (const client of mcpClients) await client.close()
    // ... 现有消息持久化逻辑
  },
})
```

### MCP 工具命名

使用 `mcp__{serverName}__{toolName}` 格式，确保与内置工具不冲突。工具 description 前追加 `[MCP: {serverName}]` 标记。

### 系统提示增强

在 `context-builder.ts` 的 `buildSystemPrompt()` 中增加 MCP 工具说明：

```
你还可以使用以下 MCP 外部工具：
- [MCP: weather] 天气查询工具
- [MCP: database] 外部数据库查询
...
```

### 确认机制

复用现有确认令牌机制。在 `Agent2UserSettings.autoConfirmTools` 中新增 `mcp` 类别：
- 默认 MCP 工具需要确认
- 用户可在设置中选择 MCP 工具自动确认

### 错误处理

- 单个 MCP 服务器连接超时或失败：跳过该服务器，记录警告日志
- 不影响其他 MCP 服务器和内置工具
- 超时使用各服务器配置的 timeout 值，默认 5000ms

## 前端组件

### 管理员 MCP 管理选项卡

在 `settings-dialog.tsx` 中新增 "MCP 服务器" 选项卡：

- 服务器列表（名称、传输类型、启用状态指示灯）
- 添加按钮 → 表单弹窗
  - 名称输入
  - 描述输入（可选）
  - 传输类型下拉（stdio / sse / http）
  - 动态配置表单（根据传输类型显示不同字段）
  - 超时时间输入（可选，默认 5000ms）
- 每行操作：编辑、删除、启用/禁用切换、连接测试按钮
- 连接测试结果展示：工具列表（名称 + 描述）

### 新增组件: `src/components/agent2/mcp-server-manager.tsx`

管理 MCP 服务器的独立组件，结构与 `model-manager.tsx` 类似。

### 普通用户 MCP 信息展示

在普通用户设置弹窗中增加 "MCP 工具" 选项卡（只读）：
- 显示已启用的 MCP 服务器列表及其提供的工具
- 让用户了解有哪些外部工具可用

### 工具确认弹窗增强

现有 `tool-confirm-dialog.tsx` 需增强：
- MCP 工具显示来源标记 `[MCP: 服务器名]`
- 展示 MCP 工具的参数 schema

## 依赖

已安装：
- `@ai-sdk/mcp`（AI SDK 的 MCP 客户端支持）
- `ai`（AI SDK 核心）

可能需要额外安装：
- `@modelcontextprotocol/sdk`（MCP 官方 SDK，用于 stdio 传输的 StdioClientTransport）

## 文件变更清单

### 新增文件
- `src/types/agent2.ts` 中新增 MCP 相关类型（修改现有文件）
- `src/validators/agent2.ts` 中新增 MCP 验证器（修改现有文件）
- `src/lib/services/agent2-mcp.service.ts`（MCP 服务器 CRUD 服务）
- `src/lib/agent2/mcp-client.ts`（MCP 客户端管理）
- `src/app/api/agent2/admin/mcp/route.ts`（MCP 服务器列表/添加 API）
- `src/app/api/agent2/admin/mcp/[id]/route.ts`（MCP 服务器更新/删除 API）
- `src/app/api/agent2/admin/mcp/[id]/test/route.ts`（连接测试 API）
- `src/components/agent2/mcp-server-manager.tsx`（MCP 管理组件）

### 修改文件
- `prisma/schema.prisma`（新增 McpTransportType 枚举和 Agent2McpServer 模型）
- `src/app/api/agent2/conversations/[id]/chat/route.ts`（集成 MCP 工具）
- `src/lib/agent2/context-builder.ts`（系统提示增加 MCP 工具说明）
- `src/lib/agent2/tools.ts`（MCP 工具确认类别支持）
- `src/components/agent2/settings-dialog.tsx`（新增 MCP 管理选项卡）
- `src/components/agent2/tool-confirm-dialog.tsx`（MCP 工具来源标记）

## 不在范围内

- 用户自定义 MCP 服务器（仅管理员配置）
- 工具级别的启用/禁用控制（仅服务器级别）
- MCP 资源（Resources）和提示（Prompts）支持
- MCP OAuth 认证流程
- MCP 工具调用的审计日志
