# AI Agent2 MCP 集成实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 ai-agent2 上集成 MCP（Model Context Protocol）功能，允许管理员配置外部 MCP 服务器，AI 在对话时调用这些工具获取外部数据。

**Architecture:** 新增 `Agent2McpServer` 数据库表存储 MCP 服务器配置，服务层处理 CRUD 和连接测试，聊天流程中通过 `@ai-sdk/mcp` 的 `createMCPClient` 连接各服务器获取工具，与内置工具合并后传给 `streamText`。前端在设置弹窗中新增 MCP 管理选项卡。

**Tech Stack:** Prisma v7, Vercel AI SDK v6 (`@ai-sdk/mcp`), Zod, shadcn/ui v4, Next.js 16 Route Handlers

---

### Task 1: 安装 @ai-sdk/mcp 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 @ai-sdk/mcp 包**

```bash
cd /home/z/test-hub/docx-template-system && npm install @ai-sdk/mcp
```

- [ ] **Step 2: 验证安装成功**

```bash
ls node_modules/@ai-sdk/mcp/dist/index.js
```

Expected: 文件存在

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: 安装 @ai-sdk/mcp 依赖"
```

---

### Task 2: Prisma Schema — 新增 McpTransportType 枚举和 Agent2McpServer 模型

**Files:**
- Modify: `prisma/schema.prisma` (文件末尾，`notifications` 模型之后)

- [ ] **Step 1: 在 `prisma/schema.prisma` 末尾追加枚举和模型**

在文件末尾追加以下内容（在最后一个 `}` 之后）：

```prisma
// ========== Agent2 MCP (Model Context Protocol) ==========

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

- [ ] **Step 2: 推送 schema 到数据库**

```bash
npx prisma db push
```

Expected: 成功，无报错

- [ ] **Step 3: 重新生成 Prisma Client**

```bash
npx prisma generate
```

Expected: 成功，输出中包含 `Agent2McpServer` 和 `McpTransportType`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma src/generated/
git commit -m "feat(agent2): 新增 McpTransportType 枚举和 Agent2McpServer 模型"
```

---

### Task 3: 类型定义 — 新增 MCP 相关类型

**Files:**
- Modify: `src/types/agent2.ts` (文件末尾追加)

- [ ] **Step 1: 在 `src/types/agent2.ts` 末尾追加 MCP 类型**

```typescript
// ============ MCP Server ============
export interface Agent2McpServerItem {
  id: string;
  name: string;
  description: string | null;
  transportType: "stdio" | "sse" | "http";
  config: McpServerConfig;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type McpServerConfig =
  | { type: "stdio"; command: string; args?: string[]; env?: Record<string, string>; timeout?: number }
  | { type: "sse"; url: string; headers?: Record<string, string>; timeout?: number }
  | { type: "http"; url: string; headers?: Record<string, string>; timeout?: number };

export interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema?: object;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/agent2.ts
git commit -m "feat(agent2): 新增 MCP 服务器和工具相关类型定义"
```

---

### Task 4: 验证器 — 新增 MCP 服务器校验 Schema

**Files:**
- Modify: `src/validators/agent2.ts` (文件末尾追加)

- [ ] **Step 1: 在 `src/validators/agent2.ts` 末尾追加 MCP 验证器**

在 `export type UpdateSettingsInput` 行之后追加：

```typescript
// ============ MCP Server ============
export const createMcpServerSchema = z.discriminatedUnion("transportType", [
  z.object({
    name: z.string().min(1).max(50),
    description: z.string().max(200).optional(),
    transportType: z.literal("stdio"),
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
    transportType: z.literal("sse"),
    config: z.object({
      url: z.string().url(),
      headers: z.record(z.string()).optional(),
      timeout: z.number().min(1000).max(60000).optional(),
    }),
  }),
  z.object({
    name: z.string().min(1).max(50),
    description: z.string().max(200).optional(),
    transportType: z.literal("http"),
    config: z.object({
      url: z.string().url(),
      headers: z.record(z.string()).optional(),
      timeout: z.number().min(1000).max(60000).optional(),
    }),
  }),
]);

export const updateMcpServerSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional().nullable(),
  enabled: z.boolean().optional(),
  config: z
    .object({
      command: z.string().min(1).optional(),
      args: z.array(z.string()).optional(),
      env: z.record(z.string()).optional(),
      url: z.string().url().optional(),
      headers: z.record(z.string()).optional(),
      timeout: z.number().min(1000).max(60000).optional(),
    })
    .optional(),
});

export type CreateMcpServerInput = z.infer<typeof createMcpServerSchema>;
export type UpdateMcpServerInput = z.infer<typeof updateMcpServerSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/validators/agent2.ts
git commit -m "feat(agent2): 新增 MCP 服务器创建/更新校验 Schema"
```

---

### Task 5: 服务层 — MCP 服务器 CRUD 服务

**Files:**
- Create: `src/lib/services/agent2-mcp.service.ts`

- [ ] **Step 1: 创建 `src/lib/services/agent2-mcp.service.ts`**

```typescript
import { db } from "@/lib/db";
import { encrypt, decrypt } from "./agent2-model.service";
import type { Agent2McpServerItem, McpServerConfig } from "@/types/agent2";
import type { ServiceResult } from "@/types/data-table";

// ── Helpers ──

type McpServerRow = {
  id: string;
  name: string;
  description: string | null;
  transportType: "stdio" | "sse" | "http";
  config: unknown;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 加密 config 中的敏感字段（headers 的值、env 的值）
 */
function encryptConfig(
  transportType: "stdio" | "sse" | "http",
  rawConfig: Record<string, unknown>
): Record<string, unknown> {
  const config = { ...rawConfig };

  if (config.headers && typeof config.headers === "object") {
    const encryptedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      config.headers as Record<string, string>
    )) {
      encryptedHeaders[key] = encrypt(value);
    }
    config.headers = encryptedHeaders;
  }

  if (transportType === "stdio" && config.env && typeof config.env === "object") {
    const encryptedEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      config.env as Record<string, string>
    )) {
      encryptedEnv[key] = encrypt(value);
    }
    config.env = encryptedEnv;
  }

  return config;
}

/**
 * 解密 config 中的敏感字段
 */
function decryptConfig(
  transportType: "stdio" | "sse" | "http",
  rawConfig: Record<string, unknown>
): Record<string, unknown> {
  const config = { ...rawConfig };

  if (config.headers && typeof config.headers === "object") {
    const decryptedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      config.headers as Record<string, string>
    )) {
      try {
        decryptedHeaders[key] = decrypt(value);
      } catch {
        // 如果解密失败，可能是未加密的值（向后兼容）
        decryptedHeaders[key] = value;
      }
    }
    config.headers = decryptedHeaders;
  }

  if (transportType === "stdio" && config.env && typeof config.env === "object") {
    const decryptedEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      config.env as Record<string, string>
    )) {
      try {
        decryptedEnv[key] = decrypt(value);
      } catch {
        decryptedEnv[key] = value;
      }
    }
    config.env = decryptedEnv;
  }

  return config;
}

/**
 * 将 config 中敏感字段掩码显示（用于 API 返回）
 */
function maskConfig(
  transportType: "stdio" | "sse" | "http",
  rawConfig: Record<string, unknown>
): Record<string, unknown> {
  const config = { ...rawConfig };

  if (config.headers && typeof config.headers === "object") {
    const maskedHeaders: Record<string, string> = {};
    for (const key of Object.keys(config.headers as Record<string, string>)) {
      maskedHeaders[key] = "••••••••";
    }
    config.headers = maskedHeaders;
  }

  if (transportType === "stdio" && config.env && typeof config.env === "object") {
    const maskedEnv: Record<string, string> = {};
    for (const key of Object.keys(config.env as Record<string, string>)) {
      maskedEnv[key] = "••••••••";
    }
    config.env = maskedEnv;
  }

  return config;
}

function mapMcpServerItem(row: McpServerRow): Agent2McpServerItem {
  const rawConfig = row.config as Record<string, unknown>;
  rawConfig.type = row.transportType;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    transportType: row.transportType,
    config: maskConfig(row.transportType, rawConfig) as unknown as McpServerConfig,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── CRUD ──

export async function listMcpServers(): Promise<
  ServiceResult<Agent2McpServerItem[]>
> {
  const servers = await db.agent2McpServer.findMany({
    orderBy: { createdAt: "desc" },
  });

  return {
    success: true,
    data: servers.map(mapMcpServerItem),
  };
}

export async function createMcpServer(data: {
  name: string;
  description?: string;
  transportType: "stdio" | "sse" | "http";
  config: Record<string, unknown>;
}): Promise<ServiceResult<Agent2McpServerItem>> {
  // Check unique name
  const existing = await db.agent2McpServer.findUnique({
    where: { name: data.name },
  });
  if (existing) {
    return {
      success: false,
      error: { code: "DUPLICATE_NAME", message: `MCP 服务器名称 "${data.name}" 已存在` },
    };
  }

  const encryptedConfig = encryptConfig(data.transportType, data.config);

  const server = await db.agent2McpServer.create({
    data: {
      name: data.name,
      description: data.description || null,
      transportType: data.transportType,
      config: encryptedConfig as unknown as Record<string, unknown>,
      enabled: true,
    },
  });

  return {
    success: true,
    data: mapMcpServerItem(server as unknown as McpServerRow),
  };
}

export async function updateMcpServer(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    enabled?: boolean;
    config?: Record<string, unknown>;
  }
): Promise<ServiceResult<Agent2McpServerItem>> {
  const existing = await db.agent2McpServer.findUnique({ where: { id } });
  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "MCP 服务器不存在" },
    };
  }

  // Check unique name if name is being changed
  if (data.name && data.name !== existing.name) {
    const duplicate = await db.agent2McpServer.findUnique({
      where: { name: data.name },
    });
    if (duplicate) {
      return {
        success: false,
        error: { code: "DUPLICATE_NAME", message: `MCP 服务器名称 "${data.name}" 已存在` },
      };
    }
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  if (data.config !== undefined) {
    const transportType = existing.transportType as "stdio" | "sse" | "http";
    updateData.config = encryptConfig(transportType, data.config);
  }

  const updated = await db.agent2McpServer.update({
    where: { id },
    data: updateData,
  });

  return {
    success: true,
    data: mapMcpServerItem(updated as unknown as McpServerRow),
  };
}

export async function deleteMcpServer(
  id: string
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.agent2McpServer.findUnique({ where: { id } });
  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "MCP 服务器不存在" },
    };
  }

  await db.agent2McpServer.delete({ where: { id } });

  return {
    success: true,
    data: { id },
  };
}

/**
 * 获取已解密的配置（用于创建 MCP 客户端连接）
 */
export async function getDecryptedMcpServer(
  id: string
): Promise<
  ServiceResult<{
    id: string;
    name: string;
    transportType: "stdio" | "sse" | "http";
    config: Record<string, unknown>;
  }>
> {
  const server = await db.agent2McpServer.findUnique({ where: { id } });
  if (!server) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "MCP 服务器不存在" },
    };
  }

  const rawConfig = server.config as Record<string, unknown>;
  rawConfig.type = server.transportType;
  const decryptedConfig = decryptConfig(
    server.transportType as "stdio" | "sse" | "http",
    rawConfig
  );

  return {
    success: true,
    data: {
      id: server.id,
      name: server.name,
      transportType: server.transportType as "stdio" | "sse" | "http",
      config: decryptedConfig,
    },
  };
}

/**
 * 获取所有已启用的 MCP 服务器（解密配置）
 */
export async function getEnabledMcpServers(): Promise<
  ServiceResult<
    Array<{
      id: string;
      name: string;
      transportType: "stdio" | "sse" | "http";
      config: Record<string, unknown>;
    }>
  >
> {
  const servers = await db.agent2McpServer.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "desc" },
  });

  const result = servers.map((server) => {
    const rawConfig = server.config as Record<string, unknown>;
    rawConfig.type = server.transportType;
    const decryptedConfig = decryptConfig(
      server.transportType as "stdio" | "sse" | "http",
      rawConfig
    );
    return {
      id: server.id,
      name: server.name,
      transportType: server.transportType as "stdio" | "sse" | "http",
      config: decryptedConfig,
    };
  });

  return { success: true, data: result };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/services/agent2-mcp.service.ts
git commit -m "feat(agent2): 新增 MCP 服务器 CRUD 服务层"
```

---

### Task 6: MCP 客户端管理 — 创建连接和获取工具

**Files:**
- Create: `src/lib/agent2/mcp-client.ts`

- [ ] **Step 1: 创建 `src/lib/agent2/mcp-client.ts`**

```typescript
import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import type { Tool } from "ai";
import { getEnabledMcpServers } from "@/lib/services/agent2-mcp.service";

interface McpToolsResult {
  tools: Record<string, Tool>;
  clients: MCPClient[];
}

/**
 * 创建单个 MCP 客户端连接
 */
async function createMcpConnection(
  server: {
    name: string;
    transportType: "stdio" | "sse" | "http";
    config: Record<string, unknown>;
  },
  timeout: number = 5000
): Promise<{ client: MCPClient; tools: Record<string, Tool> } | null> {
  try {
    let transport: unknown;

    switch (server.transportType) {
      case "stdio": {
        // 动态导入 stdio 传输
        const { Experimental_StdioMCPTransport } = await import(
          "@ai-sdk/mcp/mcp-stdio"
        );
        transport = new Experimental_StdioMCPTransport({
          command: server.config.command as string,
          args: server.config.args as string[] | undefined,
          env: server.config.env as Record<string, string> | undefined,
        });
        break;
      }
      case "sse": {
        transport = {
          type: "sse" as const,
          url: server.config.url as string,
          headers: server.config.headers as Record<string, string> | undefined,
        };
        break;
      }
      case "http": {
        transport = {
          type: "http" as const,
          url: server.config.url as string,
          headers: server.config.headers as Record<string, string> | undefined,
        };
        break;
      }
    }

    const client = await createMCPClient({ transport });

    // Set timeout for connection
    const toolsPromise = client.tools();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`MCP 服务器 "${server.name}" 连接超时 (${timeout}ms)`)),
        timeout
      )
    );

    const rawTools = await Promise.race([toolsPromise, timeoutPromise]);

    // Prefix tool names with mcp__{serverName}__ and add description tag
    const prefixedTools: Record<string, Tool> = {};
    for (const [toolName, toolDef] of Object.entries(rawTools)) {
      const prefixedName = `mcp__${server.name}__${toolName}`;
      prefixedTools[prefixedName] = {
        ...toolDef,
        description: `[MCP: ${server.name}] ${(toolDef as Tool).description || toolName}`,
      } as Tool;
    }

    return { client, tools: prefixedTools };
  } catch (error) {
    console.warn(
      `[mcp-client] Failed to connect to "${server.name}":`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * 获取所有已启用 MCP 服务器的工具
 * 单个服务器连接失败不影响其他服务器
 */
export async function getEnabledMcpTools(): Promise<McpToolsResult> {
  const result: McpToolsResult = {
    tools: {},
    clients: [],
  };

  const serversResult = await getEnabledMcpServers();
  if (!serversResult.success || serversResult.data.length === 0) {
    return result;
  }

  // Connect to all servers in parallel
  const connections = await Promise.all(
    serversResult.data.map((server) => {
      const timeout =
        typeof server.config.timeout === "number" ? server.config.timeout : 5000;
      return createMcpConnection(server, timeout);
    })
  );

  for (const connection of connections) {
    if (connection) {
      result.tools = { ...result.tools, ...connection.tools };
      result.clients.push(connection.client);
    }
  }

  return result;
}

/**
 * 测试 MCP 服务器连接并返回工具列表
 */
export async function testMcpConnection(
  server: {
    name: string;
    transportType: "stdio" | "sse" | "http";
    config: Record<string, unknown>;
  },
  timeout: number = 5000
): Promise<{
  success: boolean;
  tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>;
  error?: string;
}> {
  try {
    const connection = await createMcpConnection(server, timeout);
    if (!connection) {
      return { success: false, error: "连接失败" };
    }

    // Get tool info without the prefix
    const toolList = Object.entries(connection.tools).map(([name, toolDef]) => ({
      name: name.replace(`mcp__${server.name}__`, ""),
      description: (toolDef as Tool).description?.replace(`[MCP: ${server.name}] `, ""),
    }));

    await connection.client.close();
    return { success: true, tools: toolList };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "连接测试失败",
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent2/mcp-client.ts
git commit -m "feat(agent2): 新增 MCP 客户端管理和工具获取模块"
```

---

### Task 7: API 路由 — MCP 服务器列表和添加

**Files:**
- Create: `src/app/api/agent2/admin/mcp/route.ts`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p src/app/api/agent2/admin/mcp/\[id\]/test
```

- [ ] **Step 2: 创建 `src/app/api/agent2/admin/mcp/route.ts`**

遵循 `src/app/api/agent2/admin/models/route.ts` 的模式：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodError } from "zod";
import { listMcpServers, createMcpServer } from "@/lib/services/agent2-mcp.service";
import { createMcpServerSchema } from "@/validators/agent2";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "需要管理员权限" } },
      { status: 403 }
    );
  }

  try {
    const result = await listMcpServers();
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error ? error.message : "加载 MCP 服务器列表失败",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "需要管理员权限" } },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createMcpServerSchema.parse(body);
    const result = await createMcpServer({
      name: parsed.name,
      description: parsed.description,
      transportType: parsed.transportType,
      config: parsed.config as Record<string, unknown>,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "参数校验失败" } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error ? error.message : "创建 MCP 服务器失败",
        },
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/agent2/admin/mcp/route.ts
git commit -m "feat(agent2): 新增 MCP 服务器列表和添加 API"
```

---

### Task 8: API 路由 — MCP 服务器更新、删除和连接测试

**Files:**
- Create: `src/app/api/agent2/admin/mcp/[id]/route.ts`
- Create: `src/app/api/agent2/admin/mcp/[id]/test/route.ts`

- [ ] **Step 1: 创建 `src/app/api/agent2/admin/mcp/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodError } from "zod";
import {
  updateMcpServer,
  deleteMcpServer,
} from "@/lib/services/agent2-mcp.service";
import { updateMcpServerSchema } from "@/validators/agent2";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "需要管理员权限" } },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateMcpServerSchema.parse(body);
    const result = await updateMcpServer(id, {
      name: parsed.name,
      description: parsed.description,
      enabled: parsed.enabled,
      config: parsed.config as Record<string, unknown> | undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "参数校验失败" } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error ? error.message : "更新 MCP 服务器失败",
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "需要管理员权限" } },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const result = await deleteMcpServer(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error ? error.message : "删除 MCP 服务器失败",
        },
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 创建 `src/app/api/agent2/admin/mcp/[id]/test/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDecryptedMcpServer } from "@/lib/services/agent2-mcp.service";
import { testMcpConnection } from "@/lib/agent2/mcp-client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  _request: NextRequest,
  { params }: RouteContext
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "需要管理员权限" } },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const serverResult = await getDecryptedMcpServer(id);
    if (!serverResult.success) {
      return NextResponse.json({ error: serverResult.error }, { status: 400 });
    }

    const server = serverResult.data;
    const timeout =
      typeof server.config.timeout === "number" ? server.config.timeout : 5000;

    const testResult = await testMcpConnection(server, timeout);

    if (!testResult.success) {
      return NextResponse.json({
        success: false,
        error: { code: "CONNECTION_FAILED", message: testResult.error },
      });
    }

    return NextResponse.json({
      success: true,
      data: { tools: testResult.tools },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error ? error.message : "MCP 连接测试失败",
        },
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/agent2/admin/mcp/
git commit -m "feat(agent2): 新增 MCP 服务器更新、删除和连接测试 API"
```

---

### Task 9: 聊天流程集成 — 注入 MCP 工具

**Files:**
- Modify: `src/app/api/agent2/conversations/[id]/chat/route.ts`

- [ ] **Step 1: 在 `chat/route.ts` 中导入 MCP 工具获取函数**

在现有 import 区末尾追加：

```typescript
import { getEnabledMcpTools } from "@/lib/agent2/mcp-client";
```

- [ ] **Step 2: 在 `streamText` 调用前获取并合并 MCP 工具**

在 `src/app/api/agent2/conversations/[id]/chat/route.ts` 中，找到以下行（约第 77 行）：

```typescript
    const tools = createTools(conversationId, messageId, autoConfirm);
```

在这行之后、`// Load conversation history` 注释之前，插入：

```typescript
    // Get MCP tools from enabled servers
    const { tools: mcpTools, clients: mcpClients } = await getEnabledMcpTools();
    const allTools = { ...tools, ...mcpTools };
```

- [ ] **Step 3: 替换 streamText 中的 tools 参数和添加 MCP 清理**

找到 `const result = streamText({` 调用（约第 106 行），将 `tools,` 改为 `tools: allTools,`。

然后在 `onFinish` 回调中，在 `try` 块开头（`const persistableMessages` 之前）添加 MCP 客户端关闭：

```typescript
          // Close MCP client connections
          for (const client of mcpClients) {
            try { await client.close(); } catch { /* best effort */ }
          }
```

同样在 `catch (error)` 块中的 `console.error("Chat error:", error);` 之前添加：

```typescript
    // Close MCP clients on error
    for (const client of mcpClients) {
      try { await client.close(); } catch { /* best effort */ }
    }
```

注意：`mcpClients` 变量需要在 try 块外部声明。在 `try` 块开始处声明 `let mcpClients: MCPClient[] = [];`，然后在赋值时改为 `const mcpResult = await getEnabledMcpTools(); mcpClients = mcpResult.clients;`。为简化，可以直接在 try 内赋值，但在 catch 中需要确保 mcpClients 已定义。

实际修改方案：在 try 块最开头声明：

```typescript
  try {
    const { id: conversationId } = await params;
    // ... existing code ...
```

改为先声明 mcpClients：

```typescript
  let mcpClients: import("@ai-sdk/mcp").MCPClient[] = [];
  try {
    const { id: conversationId } = await params;
```

然后在获取 MCP 工具的地方赋值：

```typescript
    const mcpResult = await getEnabledMcpTools();
    mcpClients = mcpResult.clients;
    const allTools = { ...tools, ...mcpResult.tools };
```

在 catch 块添加清理：

```typescript
  } catch (error) {
    for (const client of mcpClients) {
      try { await client.close(); } catch { /* best effort */ }
    }
    // ... existing error handling ...
```

- [ ] **Step 4: 验证 TypeScript 编译**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 无新增错误

- [ ] **Step 5: Commit**

```bash
git add src/app/api/agent2/conversations/
git commit -m "feat(agent2): 聊天流程集成 MCP 工具"
```

---

### Task 10: 系统提示增强 — 增加 MCP 工具说明

**Files:**
- Modify: `src/lib/agent2/context-builder.ts`

- [ ] **Step 1: 在 `buildSystemPrompt()` 中添加 MCP 工具上下文**

在 `src/lib/agent2/context-builder.ts` 中，修改 `buildSystemPrompt` 函数，在 `let tableContext = "";` 之后添加 MCP 上下文获取：

```typescript
  let mcpContext = "";

  try {
    const { getEnabledMcpServers } = await import("@/lib/services/agent2-mcp.service");
    const serversResult = await getEnabledMcpServers();
    if (serversResult.success && serversResult.data.length > 0) {
      mcpContext = "\n## 可用的 MCP 外部工具\n";
      mcpContext += "你还可以使用以下 MCP 外部工具来获取外部数据。工具名称格式为 `mcp__服务器名__工具名`。\n\n";
      for (const server of serversResult.data) {
        mcpContext += `- **${server.name}** (${server.transportType}): ${server.config.url || server.config.command || ""}\n`;
      }
      mcpContext += "\n提示：使用 MCP 工具前，先了解该工具的参数要求。MCP 工具名称前缀为 `mcp__`。\n";
    }
  } catch {
    // MCP 上下文获取失败不影响系统提示
  }
```

然后在最后的 `const text = ...` 模板字符串中，在 `${tableContext}` 之后插入 `${mcpContext}`：

找到：
```typescript
	${tableContext}
	## 回答语言
```

改为：
```typescript
	${tableContext}
	${mcpContext}
	## 回答语言
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent2/context-builder.ts
git commit -m "feat(agent2): 系统提示增加 MCP 外部工具说明"
```

---

### Task 11: 确认机制 — 新增 MCP 工具类别

**Files:**
- Modify: `src/lib/agent2/confirm-store.ts`
- Modify: `src/components/agent2/settings-dialog.tsx`

- [ ] **Step 1: 在 `confirm-store.ts` 中注册 MCP 工具的风险消息**

在 `RISK_MESSAGES` 对象（约第 18 行）中追加：

```typescript
};

// MCP tool risk messages are handled dynamically — tools matching mcp__* get a generic message
```

然后在 `getRiskMessage` 函数中，在 `return RISK_MESSAGES[toolName] || "此操作需要确认";` 之前添加 MCP 工具检测：

找到：
```typescript
export function getRiskMessage(toolName: string): string {
  return RISK_MESSAGES[toolName] || "此操作需要确认";
}
```

改为：
```typescript
export function getRiskMessage(toolName: string): string {
  if (RISK_MESSAGES[toolName]) return RISK_MESSAGES[toolName];
  if (toolName.startsWith("mcp__")) {
    const serverName = toolName.split("__")[1] || "";
    return `此操作将调用外部 MCP 服务器 "${serverName}" 的工具`;
  }
  return "此操作需要确认";
}
```

- [ ] **Step 2: 在 `settings-dialog.tsx` 中添加 MCP 工具类别到自动确认列表**

在 `src/components/agent2/settings-dialog.tsx` 中的 `toolCategories` 数组（约第 49 行）追加一项：

```typescript
  const toolCategories = [
    { key: "read", label: "查询类工具", description: "搜索、查询、聚合统计" },
    { key: "write", label: "创建类工具", description: "创建记录、生成文档" },
    { key: "delete", label: "删除类工具", description: "删除记录" },
    { key: "execute", label: "执行类工具", description: "代码执行" },
    { key: "mcp", label: "MCP 外部工具", description: "调用外部 MCP 服务器工具" },
  ]
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/agent2/confirm-store.ts src/components/agent2/settings-dialog.tsx
git commit -m "feat(agent2): 新增 MCP 工具确认类别支持"
```

---

### Task 12: 工具确认弹窗 — MCP 工具来源标记

**Files:**
- Modify: `src/components/agent2/tool-confirm-dialog.tsx`
- Modify: `src/components/agent2/message-parts.tsx`

- [ ] **Step 1: 在 `tool-confirm-dialog.tsx` 中为 MCP 工具名称添加来源标记**

找到显示工具名称的地方（约第 88 行）：

```typescript
            <code className="text-sm bg-muted px-2 py-1 rounded">{toolName}</code>
```

改为：

```typescript
            <code className="text-sm bg-muted px-2 py-1 rounded">
              {toolName.startsWith("mcp__") ? (
                <>{toolName} <span className="text-xs text-muted-foreground">[外部工具]</span></>
              ) : (
                toolName
              )}
            </code>
```

- [ ] **Step 2: 在 `message-parts.tsx` 中为 MCP 工具添加类别检测**

找到 `getToolProgressLabel` 函数中的 `default:` 分支（约第 59 行）：

```typescript
    default:
      return "正在处理工具调用"
```

改为：

```typescript
    default:
      if (toolName.startsWith("mcp__")) {
        const serverName = toolName.split("__")[1] || "";
        return `正在调用 ${serverName} 工具`;
      }
      return "正在处理工具调用"
```

然后在确认对话框中传递 MCP 工具的 category。找到 `toolCategory: confirmOutput.toolCategory || "execute",` 这一行（约第 277 行），改为：

```typescript
                            toolCategory: confirmOutput.toolCategory || (toolPart.toolName.startsWith("mcp__") ? "mcp" : "execute"),
```

- [ ] **Step 3: Commit**

```bash
git add src/components/agent2/tool-confirm-dialog.tsx src/components/agent2/message-parts.tsx
git commit -m "feat(agent2): MCP 工具来源标记和进度显示"
```

---

### Task 13: 前端组件 — MCP 服务器管理器

**Files:**
- Create: `src/components/agent2/mcp-server-manager.tsx`

- [ ] **Step 1: 创建 `src/components/agent2/mcp-server-manager.tsx`**

遵循 `model-manager.tsx` 的 UI 模式：

```typescript
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Trash2, Plus, Pencil, Wifi, CheckCircle, XCircle, Power, PowerOff } from "lucide-react"
import type { Agent2McpServerItem } from "@/types/agent2"

function loadServers(): Promise<Agent2McpServerItem[]> {
  return fetch("/api/agent2/admin/mcp")
    .then(r => r.json())
    .then(data => (data.success ? data.data : []))
}

interface AddFormState {
  name: string
  description: string
  transportType: "stdio" | "sse" | "http"
  command: string
  args: string
  env: string
  url: string
  headers: string
  timeout: string
}

const emptyForm: AddFormState = {
  name: "",
  description: "",
  transportType: "sse",
  command: "",
  args: "",
  env: "",
  url: "",
  headers: "",
  timeout: "5000",
}

export function McpServerManager() {
  const [servers, setServers] = useState<Agent2McpServerItem[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<AddFormState>({ ...emptyForm })
  const [editOpen, setEditOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<Agent2McpServerItem | null>(null)
  const [editForm, setEditForm] = useState<AddFormState>({ ...emptyForm })
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] =<{
    id: string
    success: boolean
    message: string
    tools?: Array<{ name: string; description?: string }>
  } | null>(null)

  useEffect(() => {
    loadServers().then(setServers)
  }, [])

  const buildConfig = (f: AddFormState) => {
    const timeout = parseInt(f.timeout) || 5000
    switch (f.transportType) {
      case "stdio":
        return {
          command: f.command,
          args: f.args ? f.args.split(" ").filter(Boolean) : undefined,
          env: f.env ? JSON.parse(f.env) : undefined,
          timeout,
        }
      case "sse":
        return {
          url: f.url,
          headers: f.headers ? JSON.parse(f.headers) : undefined,
          timeout,
        }
      case "http":
        return {
          url: f.url,
          headers: f.headers ? JSON.parse(f.headers) : undefined,
          timeout,
        }
    }
  }

  const handleAdd = async () => {
    try {
      const config = buildConfig(form)
      const res = await fetch("/api/agent2/admin/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          transportType: form.transportType,
          config,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setAddOpen(false)
        setForm({ ...emptyForm })
        loadServers().then(setServers)
      } else {
        alert(data.error?.message || "添加失败")
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "添加失败")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此 MCP 服务器？")) return
    await fetch(`/api/agent2/admin/mcp/${id}`, { method: "DELETE" })
    loadServers().then(setServers)
  }

  const handleToggle = async (server: Agent2McpServerItem) => {
    await fetch(`/api/agent2/admin/mcp/${server.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !server.enabled }),
    })
    loadServers().then(setServers)
  }

  const handleEdit = (server: Agent2McpServerItem) => {
    setEditingServer(server)
    const config = server.config as Record<string, unknown>
    setEditForm({
      name: server.name,
      description: server.description || "",
      transportType: server.transportType,
      command: (config.command as string) || "",
      args: Array.isArray(config.args) ? (config.args as string[]).join(" ") : "",
      env: config.env ? JSON.stringify(config.env) : "",
      url: (config.url as string) || "",
      headers: config.headers ? JSON.stringify(config.headers) : "",
      timeout: String(config.timeout || 5000),
    })
    setEditOpen(true)
  }

  const handleEditSubmit = async () => {
    if (!editingServer) return
    try {
      const config = buildConfig(editForm)
      const res = await fetch(`/api/agent2/admin/mcp/${editingServer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || null,
          config,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setEditOpen(false)
        setEditingServer(null)
        loadServers().then(setServers)
      } else {
        alert(data.error?.message || "更新失败")
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "更新失败")
    }
  }

  const handleTest = async (server: Agent2McpServerItem) => {
    setTestingId(server.id)
    setTestResult(null)
    try {
      const res = await fetch(`/api/agent2/admin/mcp/${server.id}/test`, {
        method: "POST",
      })
      const data = await res.json()
      if (data.success) {
        setTestResult({
          id: server.id,
          success: true,
          message: `连接成功，发现 ${data.data.tools.length} 个工具`,
          tools: data.data.tools,
        })
      } else {
        setTestResult({
          id: server.id,
          success: false,
          message: data.error?.message || "连接失败",
        })
      }
    } catch (error) {
      setTestResult({
        id: server.id,
        success: false,
        message: error instanceof Error ? error.message : "测试失败",
      })
    } finally {
      setTestingId(null)
    }
  }

  const renderTransportFields = (
    f: AddFormState,
    setF: (fn: (prev: AddFormState) => AddFormState) => void
  ) => (
    <>
      <div>
        <label className="text-sm font-medium">传输类型</label>
        <select
          value={f.transportType}
          onChange={(e) => setF(prev => ({ ...prev, transportType: e.target.value as "stdio" | "sse" | "http" }))}
          className="w-full h-8 rounded-md border bg-background px-2 text-sm mt-1"
        >
          <option value="stdio">Stdio（本地进程）</option>
          <option value="sse">SSE（Server-Sent Events）</option>
          <option value="http">HTTP（Streamable HTTP）</option>
        </select>
      </div>
      {f.transportType === "stdio" && (
        <>
          <Input placeholder="命令 (如 npx, node, python)" value={f.command} onChange={e => setF(prev => ({ ...prev, command: e.target.value }))} />
          <Input placeholder="参数 (空格分隔，可选)" value={f.args} onChange={e => setF(prev => ({ ...prev, args: e.target.value }))} />
          <Input placeholder="环境变量 JSON (可选，如 {\"KEY\": \"value\"})" value={f.env} onChange={e => setF(prev => ({ ...prev, env: e.target.value }))} />
        </>
      )}
      {(f.transportType === "sse" || f.transportType === "http") && (
        <>
          <Input placeholder="URL (如 http://localhost:3000/mcp)" value={f.url} onChange={e => setF(prev => ({ ...prev, url: e.target.value }))} />
          <Input placeholder="请求头 JSON (可选，如 {\"Authorization\": \"Bearer xxx\"})" value={f.headers} onChange={e => setF(prev => ({ ...prev, headers: e.target.value }))} />
        </>
      )}
      <Input type="number" placeholder="连接超时 (ms，默认 5000)" value={f.timeout} onChange={e => setF(prev => ({ ...prev, timeout: e.target.value }))} />
    </>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">MCP 服务器</p>
        <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-3 mr-1" /> 添加
        </Button>
      </div>
      <div className="space-y-1">
        {servers.map(server => {
          const config = server.config as Record<string, unknown>
          return (
            <div key={server.id} className="p-2 rounded-md bg-muted/50 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full ${server.enabled ? "bg-green-500" : "bg-muted-foreground/30"}`}
                    title={server.enabled ? "已启用" : "已禁用"}
                  />
                  <div>
                    <p className="font-medium">{server.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {server.transportType.toUpperCase()} · {config.url || config.command || ""}
                      {server.description && ` · ${server.description}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {/* Test result */}
                  {testResult?.id === server.id && (
                    <span className={`text-xs ${testResult.success ? "text-green-500" : "text-destructive"}`}>
                      {testResult.message}
                    </span>
                  )}
                  <Button variant="ghost" size="icon-xs" onClick={() => handleTest(server)} disabled={testingId === server.id} title="测试连接">
                    {testingId === server.id ? <span className="size-3 animate-spin">⟳</span> : <Wifi className="size-3" />}
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => handleToggle(server)} title={server.enabled ? "禁用" : "启用"}>
                    {server.enabled ? <PowerOff className="size-3" /> : <Power className="size-3" />}
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => handleEdit(server)} title="编辑">
                    <Pencil className="size-3" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(server.id)} title="删除">
                    <Trash2 className="size-3 text-destructive" />
                  </Button>
                </div>
              </div>
              {/* Show tools if test was successful */}
              {testResult?.id === server.id && testResult.success && testResult.tools && (
                <div className="mt-1 pl-4 text-xs text-muted-foreground">
                  工具: {testResult.tools.map(t => t.name).join(", ")}
                </div>
              )}
            </div>
          )
        })}
        {servers.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">暂未配置 MCP 服务器</p>
        )}
      </div>

      {/* Add server dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加 MCP 服务器</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="服务器名称" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input placeholder="描述 (可选)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            {renderTransportFields(form, setForm)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>取消</Button>
            <Button
              onClick={handleAdd}
              disabled={!form.name || (form.transportType === "stdio" ? !form.command : !form.url)}
            >
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit server dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑 MCP 服务器</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="服务器名称" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            <Input placeholder="描述 (可选)" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            {renderTransportFields(editForm, setEditForm)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button
              onClick={handleEditSubmit}
              disabled={!editForm.name || (editForm.transportType === "stdio" ? !editForm.command : !editForm.url)}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agent2/mcp-server-manager.tsx
git commit -m "feat(agent2): 新增 MCP 服务器管理器组件"
```

---

### Task 14: 设置弹窗 — 集成 MCP 选项卡

**Files:**
- Modify: `src/components/agent2/settings-dialog.tsx`

- [ ] **Step 1: 导入 McpServerManager 组件**

在 `src/components/agent2/settings-dialog.tsx` 的 import 区域追加：

```typescript
import { McpServerManager } from "./mcp-server-manager"
```

- [ ] **Step 2: 添加 MCP 选项卡触发器和内容**

在 `TabsList` 中，在"显示设置"选项卡之后追加：

```typescript
            <TabsTrigger value="mcp" className="flex-1">MCP 服务器</TabsTrigger>
```

在 `TabsContent value="display"` 之后、`</Tabs>` 之前追加：

```typescript
          <TabsContent value="mcp" className="mt-4">
            <McpServerManager />
          </TabsContent>
```

- [ ] **Step 3: 验证构建**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 无新增错误

- [ ] **Step 4: Commit**

```bash
git add src/components/agent2/settings-dialog.tsx
git commit -m "feat(agent2): 设置弹窗新增 MCP 服务器管理选项卡"
```

---

### Task 15: 端到端验证

- [ ] **Step 1: 运行 TypeScript 类型检查**

```bash
npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 2: 运行 ESLint**

```bash
npm run lint
```

Expected: 无新增 lint 错误

- [ ] **Step 3: 运行构建**

```bash
npm run build
```

Expected: 构建成功

- [ ] **Step 4: 启动开发服务器手动验证**

```bash
npm run dev
```

手动验证：
1. 以管理员登录，打开 AI Agent2 设置弹窗
2. 切换到 "MCP 服务器" 选项卡
3. 添加一个 MCP 服务器（可用一个简单的 SSE 测试服务器）
4. 测试连接
5. 启用/禁用/编辑/删除服务器
6. 在对话中验证 MCP 工具是否被 AI 调用
