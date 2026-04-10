# REST API 开放接口（Token 认证）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为系统添加 REST API 开放接口，外部系统通过 API Token 认证后操作数据表和模板/文档生成功能。

**Architecture:** 共享 Service 层 + 独立 Token 认证中间件。v1 API 路由复用现有 `data-table.service`、`data-record.service`、`template.service`、`record.service`，仅替换认证方式。Token 管理 UI 在设置页新增标签页。

**Tech Stack:** Prisma v7, Next.js v16 Route Handlers, AES-256-GCM 加密, Zod 验证, shadcn/ui v4

**Design Spec:** `docs/superpowers/specs/2026-04-10-rest-api-token-auth-design.md`

---

## File Structure

### 新建文件
| 文件 | 职责 |
|------|------|
| `src/lib/token-crypto.ts` | Token 哈希、加密、解密工具 |
| `src/lib/api-token-auth.ts` | API Token 认证中间件 |
| `src/lib/services/api-token.service.ts` | Token CRUD 服务 |
| `src/app/api/api-tokens/route.ts` | GET 列表 / POST 创建 |
| `src/app/api/api-tokens/[id]/route.ts` | GET 详情 / DELETE 撤销 |
| `src/app/api/v1/data-tables/route.ts` | GET 列出数据表 |
| `src/app/api/v1/data-tables/[id]/route.ts` | GET 表结构 |
| `src/app/api/v1/data-tables/[id]/records/route.ts` | GET 查询 / POST 创建 |
| `src/app/api/v1/data-tables/[id]/records/[recordId]/route.ts` | PATCH 更新 / DELETE 删除 |
| `src/app/api/v1/templates/route.ts` | GET 列出模板 |
| `src/app/api/v1/templates/[id]/route.ts` | GET 模板详情 |
| `src/app/api/v1/templates/[id]/generate/route.ts` | POST 生成文档 |
| `src/components/settings/api-tokens-tab.tsx` | Token 管理 UI 标签页 |

### 修改文件
| 文件 | 修改内容 |
|------|----------|
| `prisma/schema.prisma` | 添加 ApiToken 模型 + User 反向关联 |
| `src/proxy.ts` | 放行 `/api/v1` 前缀 |
| `src/app/(dashboard)/admin/settings/page.tsx` | 添加 API Token 标签页 |

---

## Task 1: 数据库 Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 在 schema.prisma 末尾添加 ApiToken 模型**

在 `prisma/schema.prisma` 末尾（`Agent2McpServer` 模型之后）添加：

```prisma
// ========== API Token (REST API) ==========

model ApiToken {
  id              String    @id @default(cuid())
  name            String    @db.VarChar(100)
  tokenHash       String    @unique
  tokenEncrypted  String
  tokenPrefix     String    @db.VarChar(12)
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

在 User 模型中添加反向关联（`notifications` 行之后）：

```prisma
  apiTokens       ApiToken[]
```

- [ ] **Step 2: 推送 schema 到数据库**

```bash
npx prisma db push
npx prisma generate
```

- [ ] **Step 3: 提交**

```bash
git add prisma/schema.prisma
git commit -m "feat: add ApiToken model for REST API authentication"
```

---

## Task 2: Token 加密工具

**Files:**
- Create: `src/lib/token-crypto.ts`

复用 `src/lib/services/agent2-model.service.ts` 中的 AES-256-GCM 加密模式。

- [ ] **Step 1: 创建 token-crypto.ts**

创建 `src/lib/token-crypto.ts`：

```typescript
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ENCRYPTION_KEY = process.env.API_TOKEN_ENCRYPTION_KEY || "";
const ALGORITHM = "aes-256-gcm";
const TOKEN_PREFIX = "idrl_";

// Validation at module load
if (!ENCRYPTION_KEY || !/^[0-9a-f]{64}$/i.test(ENCRYPTION_KEY)) {
  console.warn(
    "[token-crypto] API_TOKEN_ENCRYPTION_KEY is not set or invalid (expected 64 hex chars). Token encryption will fail."
  );
}

/** SHA-256 hash of token for storage and lookup */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** AES-256-GCM encrypt token for reversible display */
export function encryptToken(token: string): string {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error("API_TOKEN_ENCRYPTION_KEY 未配置或无效");
  }
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return iv.toString("hex") + ":" + authTag + ":" + encrypted;
}

/** Decrypt encrypted token back to plaintext */
export function decryptToken(encryptedText: string): string {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error("API_TOKEN_ENCRYPTION_KEY 未配置或无效");
  }
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const parts = encryptedText.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/** Generate a new API token: idrl_ + 32 random hex bytes */
export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("hex");
}

/** Extract prefix for display: first 9 chars (idrl_xxxx) */
export function getTokenPrefix(token: string): string {
  return token.slice(0, 9);
}
```

- [ ] **Step 2: 在 .env.local 或 .env 中添加环境变量**

生成一个 64 字符的 hex 密钥并添加到环境变量：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

将输出添加到 `.env.local`：
```
API_TOKEN_ENCRYPTION_KEY=<生成的64字符hex>
```

- [ ] **Step 3: 提交**

```bash
git add src/lib/token-crypto.ts
git commit -m "feat: add token crypto utilities (hash, encrypt, decrypt, generate)"
```

---

## Task 3: ApiToken Service

**Files:**
- Create: `src/lib/services/api-token.service.ts`

- [ ] **Step 1: 创建 api-token.service.ts**

创建 `src/lib/services/api-token.service.ts`：

```typescript
import { db } from "@/lib/db";
import { hashToken, encryptToken, decryptToken, generateToken, getTokenPrefix } from "@/lib/token-crypto";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export interface ApiTokenListItem {
  id: string;
  name: string;
  tokenPrefix: string;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  isRevoked: boolean;
}

export interface ApiTokenDetail extends ApiTokenListItem {
  token: string;
}

export async function listTokens(
  userId: string
): Promise<ServiceResult<ApiTokenListItem[]>> {
  try {
    const tokens = await db.apiToken.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: tokens.map((t) => ({
        id: t.id,
        name: t.name,
        tokenPrefix: t.tokenPrefix,
        expiresAt: t.expiresAt,
        lastUsedAt: t.lastUsedAt,
        createdAt: t.createdAt,
        isRevoked: t.revokedAt !== null,
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取 Token 列表失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

export async function createToken(
  userId: string,
  name: string,
  expiresInDays?: number | null
): Promise<ServiceResult<ApiTokenDetail>> {
  try {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const tokenEncrypted = encryptToken(token);
    const tokenPrefix = getTokenPrefix(token);

    let expiresAt: Date | null = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    const record = await db.apiToken.create({
      data: {
        name,
        tokenHash,
        tokenEncrypted,
        tokenPrefix,
        userId,
        expiresAt,
      },
    });

    return {
      success: true,
      data: {
        id: record.id,
        name: record.name,
        token,
        tokenPrefix: record.tokenPrefix,
        expiresAt: record.expiresAt,
        lastUsedAt: record.lastUsedAt,
        createdAt: record.createdAt,
        isRevoked: false,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建 Token 失败";
    return { success: false, error: { code: "CREATE_FAILED", message } };
  }
}

export async function getTokenDetail(
  id: string,
  userId: string
): Promise<ServiceResult<ApiTokenDetail>> {
  try {
    const record = await db.apiToken.findUnique({
      where: { id },
    });

    if (!record || record.userId !== userId) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Token 不存在" },
      };
    }

    const token = decryptToken(record.tokenEncrypted);

    return {
      success: true,
      data: {
        id: record.id,
        name: record.name,
        token,
        tokenPrefix: record.tokenPrefix,
        expiresAt: record.expiresAt,
        lastUsedAt: record.lastUsedAt,
        createdAt: record.createdAt,
        isRevoked: record.revokedAt !== null,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取 Token 详情失败";
    return { success: false, error: { code: "GET_FAILED", message } };
  }
}

export async function revokeToken(
  id: string,
  userId: string
): Promise<ServiceResult<null>> {
  try {
    const record = await db.apiToken.findUnique({
      where: { id },
    });

    if (!record || record.userId !== userId) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Token 不存在" },
      };
    }

    if (record.revokedAt) {
      return {
        success: false,
        error: { code: "ALREADY_REVOKED", message: "Token 已被撤销" },
      };
    }

    await db.apiToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "撤销 Token 失败";
    return { success: false, error: { code: "REVOKE_FAILED", message } };
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/services/api-token.service.ts
git commit -m "feat: add ApiToken CRUD service (list, create, getDetail, revoke)"
```

---

## Task 4: Token 认证中间件

**Files:**
- Create: `src/lib/api-token-auth.ts`

- [ ] **Step 1: 创建 api-token-auth.ts**

创建 `src/lib/api-token-auth.ts`：

```typescript
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import { hashToken } from "@/lib/token-crypto";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export interface AuthenticatedUser {
  userId: string;
  role: Role;
}

/**
 * Authenticate request via API Token (Bearer token in Authorization header).
 * Returns the authenticated user's ID and role on success.
 */
export async function authenticateApiToken(
  request: Request
): Promise<ServiceResult<AuthenticatedUser>> {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "缺少 Authorization 头或格式错误" },
      };
    }

    const token = authHeader.slice(7); // Remove "Bearer "

    if (!token.startsWith("idrl_")) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "无效的 API Token 格式" },
      };
    }

    const tokenHash = hashToken(token);

    const apiToken = await db.apiToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, role: true } } },
    });

    if (!apiToken) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "无效的 API Token" },
      };
    }

    // Check revoked
    if (apiToken.revokedAt) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Token 已被撤销" },
      };
    }

    // Check expired
    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Token 已过期" },
      };
    }

    // Check user exists
    if (!apiToken.user) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Token 关联用户不存在" },
      };
    }

    // Update lastUsedAt (fire-and-forget)
    db.apiToken
      .update({
        where: { id: apiToken.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});

    return {
      success: true,
      data: {
        userId: apiToken.user.id,
        role: apiToken.user.role,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "认证失败";
    return { success: false, error: { code: "INTERNAL_ERROR", message } };
  }
}

/** Helper: create a standardized v1 error response */
export function apiErrorResponse(
  code: string,
  message: string,
  status: number
): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/api-token-auth.ts
git commit -m "feat: add API Token authentication middleware"
```

---

## Task 5: 更新 proxy.ts

**Files:**
- Modify: `src/proxy.ts`

- [ ] **Step 1: 在 proxy.ts 中放行 /api/v1 路由**

在 `proxy.ts` 中，在现有的 auth routes 放行逻辑之后添加 `/api/v1` 放行：

```typescript
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow auth-related routes
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/ai-agent")
  ) {
    return NextResponse.next();
  }

  // Allow v1 API routes (uses Token auth, not session)
  if (pathname.startsWith("/api/v1")) {
    return NextResponse.next();
  }

  // ... rest of existing proxy logic
```

- [ ] **Step 2: 提交**

```bash
git add src/proxy.ts
git commit -m "feat: allow /api/v1 routes in proxy (Token auth, not session)"
```

---

## Task 6: Token 管理 API 路由

**Files:**
- Create: `src/app/api/api-tokens/route.ts`
- Create: `src/app/api/api-tokens/[id]/route.ts`

Token 管理 API 使用 session 认证（非 Token 认证），放在 `/api/api-tokens` 路径。

- [ ] **Step 1: 创建 /api/api-tokens/route.ts**

创建 `src/app/api/api-tokens/route.ts`：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getRouteSessionUser } from "@/lib/auth";
import { listTokens, createToken } from "@/lib/services/api-token.service";

export async function GET(request: NextRequest) {
  const user = await getRouteSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const result = await listTokens(user.id);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ tokens: result.data });
}

export async function POST(request: NextRequest) {
  const user = await getRouteSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = (body.name as string)?.trim();
    if (!name || name.length > 100) {
      return NextResponse.json(
        { error: "名称不能为空且不能超过100个字符" },
        { status: 400 }
      );
    }

    const expiresInDays = body.expiresInDays as number | null | undefined;

    const result = await createToken(user.id, name, expiresInDays ?? null);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "创建 Token 失败" }, { status: 500 });
  }
}
```

- [ ] **Step 2: 创建 /api/api-tokens/[id]/route.ts**

创建 `src/app/api/api-tokens/[id]/route.ts`：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getRouteSessionUser } from "@/lib/auth";
import { getTokenDetail, revokeToken } from "@/lib/services/api-token.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getRouteSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;
  const result = await getTokenDetail(id, user.id);

  if (!result.success) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: result.error.message }, { status });
  }

  return NextResponse.json(result.data);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getRouteSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;
  const result = await revokeToken(id, user.id);

  if (!result.success) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: result.error.message }, { status });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: 提交**

```bash
git add src/app/api/api-tokens/
git commit -m "feat: add API Token management routes (list, create, detail, revoke)"
```

---

## Task 7: V1 数据表 API 路由

**Files:**
- Create: `src/app/api/v1/data-tables/route.ts`
- Create: `src/app/api/v1/data-tables/[id]/route.ts`
- Create: `src/app/api/v1/data-tables/[id]/records/route.ts`
- Create: `src/app/api/v1/data-tables/[id]/records/[recordId]/route.ts`

所有 v1 路由使用 `authenticateApiToken` 认证，复用现有 service。

- [ ] **Step 1: 创建 /api/v1/data-tables/route.ts**

创建 `src/app/api/v1/data-tables/route.ts`：

```typescript
import { NextRequest } from "next/server";
import { authenticateApiToken, apiErrorResponse } from "@/lib/api-token-auth";
import { listTables } from "@/lib/services/data-table.service";

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.success) {
    return apiErrorResponse(authResult.error.code, authResult.error.message, 401);
  }

  const result = await listTables();

  if (!result.success) {
    return apiErrorResponse("INTERNAL_ERROR", result.error.message, 500);
  }

  return Response.json({ data: result.data });
}
```

- [ ] **Step 2: 创建 /api/v1/data-tables/[id]/route.ts**

创建 `src/app/api/v1/data-tables/[id]/route.ts`：

```typescript
import { NextRequest } from "next/server";
import { authenticateApiToken, apiErrorResponse } from "@/lib/api-token-auth";
import { getTable } from "@/lib/services/data-table.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.success) {
    return apiErrorResponse(authResult.error.code, authResult.error.message, 401);
  }

  const { id } = await params;
  const result = await getTable(id);

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return apiErrorResponse("NOT_FOUND", result.error.message, 404);
    }
    return apiErrorResponse("INTERNAL_ERROR", result.error.message, 500);
  }

  return Response.json({ data: result.data });
}
```

- [ ] **Step 3: 创建 /api/v1/data-tables/[id]/records/route.ts**

创建 `src/app/api/v1/data-tables/[id]/records/route.ts`：

```typescript
import { NextRequest } from "next/server";
import { authenticateApiToken, apiErrorResponse } from "@/lib/api-token-auth";
import { listRecords, createRecord } from "@/lib/services/data-record.service";
import { createRecordSchema } from "@/validators/data-table";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.success) {
    return apiErrorResponse(authResult.error.code, authResult.error.message, 401);
  }

  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20", 10), 100);
  const search = searchParams.get("search") || undefined;

  const result = await listRecords(id, { page, pageSize, search });

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return apiErrorResponse("NOT_FOUND", result.error.message, 404);
    }
    return apiErrorResponse("INTERNAL_ERROR", result.error.message, 500);
  }

  return Response.json({ data: result.data });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.success) {
    return apiErrorResponse(authResult.error.code, authResult.error.message, 401);
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const validated = createRecordSchema.parse(body);

    const result = await createRecord(authResult.data.userId, id, validated.data);

    if (!result.success) {
      if (result.error.code === "NOT_FOUND") {
        return apiErrorResponse("NOT_FOUND", result.error.message, 404);
      }
      return apiErrorResponse("VALIDATION_ERROR", result.error.message, 400);
    }

    return Response.json({ data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return apiErrorResponse("VALIDATION_ERROR", "请求数据验证失败", 400);
    }
    return apiErrorResponse("INTERNAL_ERROR", "创建记录失败", 500);
  }
}
```

- [ ] **Step 4: 创建 /api/v1/data-tables/[id]/records/[recordId]/route.ts**

创建 `src/app/api/v1/data-tables/[id]/records/[recordId]/route.ts`：

```typescript
import { NextRequest } from "next/server";
import { authenticateApiToken, apiErrorResponse } from "@/lib/api-token-auth";
import { updateRecord, deleteRecord } from "@/lib/services/data-record.service";
import { updateRecordSchema } from "@/validators/data-table";

interface RouteParams {
  params: Promise<{ id: string; recordId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.success) {
    return apiErrorResponse(authResult.error.code, authResult.error.message, 401);
  }

  const { recordId } = await params;

  try {
    const body = await request.json();
    const validated = updateRecordSchema.parse(body);

    const result = await updateRecord(recordId, validated.data, authResult.data.userId);

    if (!result.success) {
      if (result.error.code === "NOT_FOUND") {
        return apiErrorResponse("NOT_FOUND", result.error.message, 404);
      }
      return apiErrorResponse("VALIDATION_ERROR", result.error.message, 400);
    }

    return Response.json({ data: result.data });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return apiErrorResponse("VALIDATION_ERROR", "请求数据验证失败", 400);
    }
    return apiErrorResponse("INTERNAL_ERROR", "更新记录失败", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.success) {
    return apiErrorResponse(authResult.error.code, authResult.error.message, 401);
  }

  const { recordId } = await params;
  const result = await deleteRecord(recordId);

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return apiErrorResponse("NOT_FOUND", result.error.message, 404);
    }
    return apiErrorResponse("INTERNAL_ERROR", result.error.message, 500);
  }

  return Response.json({ data: { deleted: true } });
}
```

- [ ] **Step 5: 提交**

```bash
git add src/app/api/v1/data-tables/
git commit -m "feat: add v1 data-tables API routes (list, detail, records CRUD)"
```

---

## Task 8: V1 模板与文档生成 API 路由

**Files:**
- Create: `src/app/api/v1/templates/route.ts`
- Create: `src/app/api/v1/templates/[id]/route.ts`
- Create: `src/app/api/v1/templates/[id]/generate/route.ts`

- [ ] **Step 1: 创建 /api/v1/templates/route.ts**

创建 `src/app/api/v1/templates/route.ts`：

```typescript
import { NextRequest } from "next/server";
import { authenticateApiToken, apiErrorResponse } from "@/lib/api-token-auth";
import { listTemplates } from "@/lib/services/template.service";

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.success) {
    return apiErrorResponse(authResult.error.code, authResult.error.message, 401);
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20", 10), 100);
  const search = searchParams.get("search") || undefined;

  const result = await listTemplates({
    page,
    pageSize,
    status: "PUBLISHED",
    search: search || undefined,
  });

  if (!result.success) {
    return apiErrorResponse("INTERNAL_ERROR", result.error.message, 500);
  }

  return Response.json({ data: result.data.items });
}
```

- [ ] **Step 2: 创建 /api/v1/templates/[id]/route.ts**

创建 `src/app/api/v1/templates/[id]/route.ts`：

```typescript
import { NextRequest } from "next/server";
import { authenticateApiToken, apiErrorResponse } from "@/lib/api-token-auth";
import { getTemplate } from "@/lib/services/template.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.success) {
    return apiErrorResponse(authResult.error.code, authResult.error.message, 401);
  }

  const { id } = await params;
  const result = await getTemplate(id);

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return apiErrorResponse("NOT_FOUND", result.error.message, 404);
    }
    return apiErrorResponse("INTERNAL_ERROR", result.error.message, 500);
  }

  // Map to v1 response format (exclude internal fields)
  const template = result.data;
  return Response.json({
    data: {
      id: template.id,
      name: template.name,
      description: template.description,
      placeholders: template.placeholders.map((p) => ({
        key: p.key,
        label: p.label,
        type: p.inputType,
        required: p.required,
        defaultValue: p.defaultValue,
      })),
      createdAt: template.createdAt,
    },
  });
}
```

- [ ] **Step 3: 创建 /api/v1/templates/[id]/generate/route.ts**

这个端点需要：1) 验证 Token，2) 创建 Record，3) 调用 Python 服务生成文档，4) 返回文件流。复用 `record.service.ts` 中的 `createRecord` 和 `generateDocument`。

创建 `src/app/api/v1/templates/[id]/generate/route.ts`：

```typescript
import { NextRequest } from "next/server";
import { authenticateApiToken, apiErrorResponse } from "@/lib/api-token-auth";
import { getTemplate } from "@/lib/services/template.service";
import { createRecord, generateDocument } from "@/lib/services/record.service";
import { db } from "@/lib/db";
import { join } from "path";
import { UPLOAD_DIR } from "@/lib/constants/upload";
import { PYTHON_SERVICE_URL } from "@/lib/constants";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { RecordStatus } from "@/generated/prisma/enums";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.success) {
    return apiErrorResponse(authResult.error.code, authResult.error.message, 401);
  }

  const { id } = await params;

  // Validate template exists and is published
  const templateResult = await getTemplate(id);
  if (!templateResult.success) {
    if (templateResult.error.code === "NOT_FOUND") {
      return apiErrorResponse("NOT_FOUND", templateResult.error.message, 404);
    }
    return apiErrorResponse("INTERNAL_ERROR", templateResult.error.message, 500);
  }

  const template = templateResult.data;
  if (template.status !== "PUBLISHED") {
    return apiErrorResponse("FORBIDDEN", "模板未发布，无法生成文档", 403);
  }

  // Parse form data
  let formData: Record<string, string>;
  try {
    const body = await request.json();
    formData = body.formData as Record<string, string>;
    if (!formData || typeof formData !== "object") {
      return apiErrorResponse("VALIDATION_ERROR", "formData 字段不能为空", 400);
    }
  } catch {
    return apiErrorResponse("VALIDATION_ERROR", "请求体格式错误", 400);
  }

  // Create a record
  const recordResult = await createRecord(authResult.data.userId, id, formData);
  if (!recordResult.success) {
    return apiErrorResponse("INTERNAL_ERROR", recordResult.error.message, 500);
  }

  // Generate document
  const generateResult = await generateDocument(recordResult.data.id);
  if (!generateResult.success) {
    return apiErrorResponse("INTERNAL_ERROR", generateResult.error.message, 500);
  }

  // Read the generated file and return as stream
  const filePath = generateResult.data.filePath;
  if (!filePath) {
    return apiErrorResponse("INTERNAL_ERROR", "文档生成失败：文件路径为空", 500);
  }

  try {
    const { readFile } = await import("fs/promises");
    const fileBuffer = await readFile(filePath);
    const fileName = generateResult.data.fileName || `${template.name}.docx`;

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch {
    return apiErrorResponse("INTERNAL_ERROR", "读取生成的文档失败", 500);
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add src/app/api/v1/templates/
git commit -m "feat: add v1 templates API routes (list, detail, generate)"
```

---

## Task 9: Token 管理 UI

**Files:**
- Create: `src/components/settings/api-tokens-tab.tsx`
- Modify: `src/app/(dashboard)/admin/settings/page.tsx`

- [ ] **Step 1: 创建 api-tokens-tab.tsx**

创建 `src/components/settings/api-tokens-tab.tsx`：

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface TokenItem {
  id: string;
  name: string;
  tokenPrefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  isRevoked: boolean;
}

export function ApiTokensTab() {
  const { data: session } = useSession();
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [expiresIn, setExpiresIn] = useState<string>("never");

  // Show token dialog state
  const [showTokenOpen, setShowTokenOpen] = useState(false);
  const [revealedToken, setRevealedToken] = useState("");
  const [revealingTokenId, setRevealingTokenId] = useState<string | null>(null);

  // Created token dialog
  const [createdTokenOpen, setCreatedTokenOpen] = useState(false);
  const [newToken, setNewToken] = useState("");

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/api-tokens");
      if (res.ok) {
        const data = await res.json();
        setTokens(data.tokens);
      }
    } catch {
      toast.error("获取 Token 列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const handleCreate = async () => {
    if (!tokenName.trim()) {
      toast.error("请输入 Token 名称");
      return;
    }

    try {
      const expiresInDays =
        expiresIn === "never"
          ? null
          : expiresIn === "30"
            ? 30
            : expiresIn === "90"
              ? 90
              : null;

      const res = await fetch("/api/api-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tokenName.trim(),
          expiresInDays,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setNewToken(data.token);
        setCreatedTokenOpen(true);
        setCreateOpen(false);
        setTokenName("");
        setExpiresIn("never");
        fetchTokens();
        toast.success("Token 创建成功");
      } else {
        const data = await res.json();
        toast.error(data.error || "创建失败");
      }
    } catch {
      toast.error("创建 Token 失败");
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("确定要撤销此 Token 吗？撤销后使用此 Token 的请求将被拒绝。")) return;

    try {
      const res = await fetch(`/api/api-tokens/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Token 已撤销");
        fetchTokens();
      } else {
        const data = await res.json();
        toast.error(data.error || "撤销失败");
      }
    } catch {
      toast.error("撤销 Token 失败");
    }
  };

  const handleRevealToken = async (id: string) => {
    try {
      const res = await fetch(`/api/api-tokens/${id}`);
      if (res.ok) {
        const data = await res.json();
        setRevealedToken(data.token);
        setRevealingTokenId(id);
        setShowTokenOpen(true);
      } else {
        toast.error("获取 Token 失败");
      }
    } catch {
      toast.error("获取 Token 失败");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已复制到剪贴板");
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("zh-CN");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">API Token</h2>
          <p className="text-sm text-muted-foreground">
            管理 API Token，允许外部系统通过 Token 访问系统数据。
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>创建 Token</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建 API Token</DialogTitle>
              <DialogDescription>
                创建后可查看完整 Token。Token 继承你的账户权限。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">名称</label>
                <Input
                  placeholder="例如：CRM 集成"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">过期时间</label>
                <Select value={expiresIn} onValueChange={setExpiresIn}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">永不过期</SelectItem>
                    <SelectItem value="30">30 天</SelectItem>
                    <SelectItem value="90">90 天</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreate}>创建</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Created token display dialog */}
        <Dialog open={createdTokenOpen} onOpenChange={setCreatedTokenOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Token 创建成功</DialogTitle>
              <DialogDescription>
                请复制此 Token。你可以随时在 Token 管理页面再次查看。
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-muted rounded text-sm font-mono break-all">
                  {newToken}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(newToken)}
                >
                  复制
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setCreatedTokenOpen(false)}>关闭</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reveal token dialog */}
        <Dialog open={showTokenOpen} onOpenChange={setShowTokenOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Token 明文</DialogTitle>
              <DialogDescription>
                请妥善保管此 Token，不要泄露给未授权人员。
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-muted rounded text-sm font-mono break-all">
                  {revealedToken}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(revealedToken)}
                >
                  复制
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowTokenOpen(false)}>关闭</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : tokens.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          还没有创建任何 Token
        </div>
      ) : (
        <div className="border rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-sm font-medium">名称</th>
                <th className="text-left p-3 text-sm font-medium">Token</th>
                <th className="text-left p-3 text-sm font-medium">过期时间</th>
                <th className="text-left p-3 text-sm font-medium">最后使用</th>
                <th className="text-left p-3 text-sm font-medium">状态</th>
                <th className="text-right p-3 text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id} className="border-b last:border-0">
                  <td className="p-3 text-sm">{token.name}</td>
                  <td className="p-3 text-sm font-mono text-muted-foreground">
                    {token.tokenPrefix}...
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {formatDate(token.expiresAt)}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {formatDate(token.lastUsedAt)}
                  </td>
                  <td className="p-3 text-sm">
                    {token.isRevoked ? (
                      <span className="text-destructive">已撤销</span>
                    ) : (
                      <span className="text-green-600">活跃</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      {!token.isRevoked && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevealToken(token.id)}
                          >
                            查看
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleRevoke(token.id)}
                          >
                            撤销
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 修改设置页面，添加 API Token 标签页**

修改 `src/app/(dashboard)/admin/settings/page.tsx`：

```tsx
import { AdminModelManager } from "@/components/agent2/admin-model-manager";
import { ApiTokensTab } from "@/components/settings/api-tokens-tab";

export default function AdminSettingsPage() {
  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">系统设置</h1>
      <div className="space-y-6">
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">AI 模型配置</h2>
          <p className="text-sm text-muted-foreground mb-6">
            在此处配置全局模型，这些模型将对所有用户可见。用户也可以添加自己的自定义模型。
          </p>
          <AdminModelManager />
        </div>

        <div className="bg-card rounded-lg border p-6">
          <ApiTokensTab />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add src/components/settings/api-tokens-tab.tsx src/app/\(dashboard\)/admin/settings/page.tsx
git commit -m "feat: add API Token management UI tab in settings page"
```

---

## Task 10: 类型检查与构建验证

**Files:** 无新增

- [ ] **Step 1: 运行类型检查**

```bash
npx tsc --noEmit
```

修复所有类型错误。

- [ ] **Step 2: 运行 lint**

```bash
npm run lint
```

修复所有 lint 错误。

- [ ] **Step 3: 运行构建**

```bash
npm run build
```

确保构建成功。

- [ ] **Step 4: 提交修复（如有）**

```bash
git add -A
git commit -m "fix: resolve type and lint errors for REST API feature"
```

---

## Task 11: 端到端手动验证

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 验证 Token 管理 UI**

1. 浏览器访问 `http://localhost:8060/admin/settings`
2. 在 "API Token" 区域创建一个 Token
3. 验证 Token 明文正确显示
4. 验证"查看"按钮可以再次显示 Token
5. 验证"撤销"按钮可以撤销 Token

- [ ] **Step 3: 验证 V1 数据表 API**

```bash
# 列出数据表
curl -H "Authorization: Bearer <token>" http://localhost:8060/api/v1/data-tables

# 获取表结构
curl -H "Authorization: Bearer <token>" http://localhost:8060/api/v1/data-tables/<table-id>

# 查询记录
curl -H "Authorization: Bearer <token>" "http://localhost:8060/api/v1/data-tables/<table-id>/records?page=1&pageSize=10"

# 创建记录
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"data": {"name": "测试"}}' \
  http://localhost:8060/api/v1/data-tables/<table-id>/records

# 删除记录
curl -X DELETE -H "Authorization: Bearer <token>" \
  http://localhost:8060/api/v1/data-tables/<table-id>/records/<record-id>
```

- [ ] **Step 4: 验证 V1 模板 API**

```bash
# 列出模板
curl -H "Authorization: Bearer <token>" http://localhost:8060/api/v1/templates

# 获取模板详情
curl -H "Authorization: Bearer <token>" http://localhost:8060/api/v1/templates/<template-id>

# 生成文档
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"formData": {"key": "value"}}' \
  http://localhost:8060/api/v1/templates/<template-id>/generate \
  -o output.docx
```

- [ ] **Step 5: 验证错误场景**

```bash
# 无 Token
curl http://localhost:8060/api/v1/data-tables
# 预期: 401 {"error":{"code":"UNAUTHORIZED","message":"缺少 Authorization 头或格式错误"}}

# 无效 Token
curl -H "Authorization: Bearer idrl_invalid" http://localhost:8060/api/v1/data-tables
# 预期: 401 {"error":{"code":"UNAUTHORIZED","message":"无效的 API Token"}}

# 撤销后的 Token
curl -H "Authorization: Bearer <revoked-token>" http://localhost:8060/api/v1/data-tables
# 预期: 401 {"error":{"code":"UNAUTHORIZED","message":"Token 已被撤销"}}
```

---

## Task 12: 最终提交与分支创建

- [ ] **Step 1: 创建分支并推送**

```bash
git checkout -b feature/issue-31-rest-api-token-auth
git push -u origin feature/issue-31-rest-api-token-auth
```

- [ ] **Step 2: 创建 PR**

```bash
gh pr create --title "[Feature] REST API 开放接口（Token 认证）" --body "$(cat <<'EOF'
## Summary
- 添加 API Token 管理功能（创建、查看、撤销）
- 添加 v1 数据表 API（列出、详情、记录 CRUD）
- 添加 v1 模板/文档生成 API（列出、详情、生成文档）
- 设置页面新增 API Token 管理标签页

## Test plan
- [ ] 创建/查看/撤销 Token 功能正常
- [ ] v1 数据表 API 端点返回正确数据
- [ ] v1 模板 API 端点返回正确数据
- [ ] v1 文档生成 API 返回正确的 docx 文件
- [ ] 无 Token / 无效 Token / 已撤销 Token 返回 401
- [ ] `npx tsc --noEmit` 无错误
- [ ] `npm run build` 成功

Closes #31
EOF
)"
```
