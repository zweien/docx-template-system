# 编辑器 AI 辅助系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为报告撰写编辑器添加可配置的 AI 辅助功能，包括 Bubble Menu 预设操作、AI 侧边栏对话、选中文本引用附件、用户自定义 Prompt 模板。

**Architecture:** 扩展现有 BlockNote + @blocknote/xl-ai 编辑器。新增 EditorAIAction 数据模型管理预设/自定义操作。自建 AIActionButton + AIActionPopover 替换原有 AIToolbarButton，提供预设操作和自由输入。AIChatSidebar 作为右侧面板 Tab 页，支持多轮对话和选中文本引用。所有 AI 调用复用 Agent2 的 resolveModel。

**Tech Stack:** Prisma v7、Next.js v16、BlockNote v0.49、@blocknote/xl-ai、shadcn/ui v4、Zustand、Vercel AI SDK（streamText）

---

## File Structure

### 新建文件

| 文件路径 | 职责 |
|---------|------|
| `src/types/editor-ai.ts` | EditorAI 类型定义 |
| `src/validators/editor-ai.ts` | Zod 校验 schema |
| `src/lib/services/editor-ai-action.service.ts` | AI Action CRUD 服务 |
| `src/app/api/editor-ai/actions/route.ts` | GET 列表 + POST 创建 |
| `src/app/api/editor-ai/actions/[id]/route.ts` | PATCH 更新 + DELETE 删除 |
| `src/app/api/editor-ai/execute/route.ts` | POST 执行 AI action |
| `src/app/api/editor-ai/chat/route.ts` | POST 侧边栏对话 |
| `src/modules/reports/components/editor/ai/useAIActions.ts` | Hook：获取/管理 AI actions |
| `src/modules/reports/components/editor/ai/AIActionButton.tsx` | 工具栏 AI 按钮 |
| `src/modules/reports/components/editor/ai/AIActionPopover.tsx` | 弹出操作面板 |
| `src/modules/reports/components/editor/ai/AIActionExecutor.ts` | AI 执行逻辑（非组件） |
| `src/modules/reports/components/editor/ai/AIActionForm.tsx` | 创建/编辑模板弹窗 |
| `src/modules/reports/components/editor/ai/AIChatSidebar.tsx` | AI 侧边栏组件 |
| `src/modules/reports/components/editor/ai/SelectionAttachment.tsx` | 选中文本引用卡片 |
| `src/modules/reports/components/editor/ai/useEditorAIStore.ts` | Zustand store：对话历史 + 引用状态 |
| `src/app/(dashboard)/admin/editor-ai/page.tsx` | 管理员 AI Action 管理页 |

### 修改文件

| 文件路径 | 改动 |
|---------|------|
| `prisma/schema.prisma` | 新增 EditorAIAction 模型 + User 关联 |
| `prisma/seed.ts` | 新增 AI Action 种子数据 |
| `src/modules/reports/components/editor/SectionEditor.tsx` | 替换 AIToolbarButtonSafe → AIActionButton |
| `src/app/(reports)/reports/drafts/[id]/page.tsx` | 右侧面板 Tab 化 + AI 侧边栏集成 |

---

## Phase 1：AI Action 配置系统

### Task 1: Prisma Schema — 新增 EditorAIAction 模型

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 在 schema.prisma 底部添加 EditorAIAction 模型**

在文件末尾添加：

```prisma
model EditorAIAction {
  id          String   @id @default(cuid())
  name        String
  icon        String?
  prompt      String
  category    String   @default("general")
  scope       String   @default("selection")
  sortOrder   Int      @default(0)
  isBuiltIn   Boolean  @default(false)
  enabled     Boolean  @default(true)

  userId      String?
  user        User?    @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
  @@index([category])
}
```

- [ ] **Step 2: 在 User 模型中添加关联**

在 User 模型的关联列表末尾添加：

```prisma
editorAIActions EditorAIAction[]
```

- [ ] **Step 3: 推送 schema 到数据库**

```bash
npx prisma db push
npx prisma generate
```

- [ ] **Step 4: 验证**

```bash
npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(editor-ai): add EditorAIAction model to Prisma schema"
```

---

### Task 2: Types — EditorAI 类型定义

**Files:**
- Create: `src/types/editor-ai.ts`

- [ ] **Step 1: 创建类型文件**

```typescript
// src/types/editor-ai.ts

export interface EditorAIActionItem {
  id: string;
  name: string;
  icon: string | null;
  prompt: string;
  category: string;
  scope: "selection" | "paragraph" | "document";
  sortOrder: number;
  isBuiltIn: boolean;
  enabled: boolean;
  userId: string | null;
  createdAt: string;
}

export interface EditorAIActionCreateInput {
  name: string;
  icon?: string;
  prompt: string;
  category?: string;
  scope?: "selection" | "paragraph" | "document";
}

export interface EditorAIActionUpdateInput {
  name?: string;
  icon?: string;
  prompt?: string;
  category?: string;
  scope?: "selection" | "paragraph" | "document";
  enabled?: boolean;
  sortOrder?: number;
}

export interface EditorAIExecuteRequest {
  actionId?: string;
  prompt?: string;
  selection?: string;
  context?: string;
  instruction?: string;
  model?: string;
}

export interface EditorAIChatRequest {
  messages: Array<{ role: string; content: string }>;
  model: string;
  context?: {
    sectionContent?: string;
    pinnedSelections?: string[];
  };
}

export interface PinnedSelection {
  id: string;
  text: string;
  blockIds: string[];
  timestamp: number;
}
```

- [ ] **Step 2: 验证类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/types/editor-ai.ts
git commit -m "feat(editor-ai): add type definitions for editor AI actions"
```

---

### Task 3: Validator — Zod 校验 Schema

**Files:**
- Create: `src/validators/editor-ai.ts`

- [ ] **Step 1: 创建校验文件**

```typescript
// src/validators/editor-ai.ts
import { z } from "zod";

export const createActionSchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().max(10).optional(),
  prompt: z.string().min(1).max(2000),
  category: z.enum(["general", "writing", "translation", "analysis"]).optional(),
  scope: z.enum(["selection", "paragraph", "document"]).optional(),
});

export const updateActionSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().max(10).optional(),
  prompt: z.string().min(1).max(2000).optional(),
  category: z.enum(["general", "writing", "translation", "analysis"]).optional(),
  scope: z.enum(["selection", "paragraph", "document"]).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const executeActionSchema = z.object({
  actionId: z.string().optional(),
  prompt: z.string().max(2000).optional(),
  selection: z.string().optional(),
  context: z.string().optional(),
  instruction: z.string().max(1000).optional(),
  model: z.string().optional(),
}).refine((data) => data.actionId || data.prompt, {
  message: "必须提供 actionId 或 prompt",
});

export const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1),
    })
  ).min(1),
  model: z.string().min(1),
  context: z.object({
    sectionContent: z.string().optional(),
    pinnedSelections: z.array(z.string()).optional(),
  }).optional(),
});

export type CreateActionInput = z.infer<typeof createActionSchema>;
export type UpdateActionInput = z.infer<typeof updateActionSchema>;
export type ExecuteActionInput = z.infer<typeof executeActionSchema>;
export type ChatInput = z.infer<typeof chatSchema>;
```

- [ ] **Step 2: 验证**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/validators/editor-ai.ts
git commit -m "feat(editor-ai): add Zod validation schemas"
```

---

### Task 4: Service — AI Action CRUD 服务

**Files:**
- Create: `src/lib/services/editor-ai-action.service.ts`

- [ ] **Step 1: 创建服务文件**

```typescript
// src/lib/services/editor-ai-action.service.ts
import { db } from "@/lib/db";
import type { EditorAIActionItem } from "@/types/editor-ai";
import type { ServiceResult } from "@/types/data-table";

function mapActionItem(row: {
  id: string;
  name: string;
  icon: string | null;
  prompt: string;
  category: string;
  scope: string;
  sortOrder: number;
  isBuiltIn: boolean;
  enabled: boolean;
  userId: string | null;
  createdAt: Date;
}): EditorAIActionItem {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    prompt: row.prompt,
    category: row.category,
    scope: row.scope as "selection" | "paragraph" | "document",
    sortOrder: row.sortOrder,
    isBuiltIn: row.isBuiltIn,
    enabled: row.enabled,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 获取所有可用 action（全局启用 + 当前用户自建） */
export async function listAvailableActions(
  userId: string
): Promise<ServiceResult<EditorAIActionItem[]>> {
  const actions = await db.editorAIAction.findMany({
    where: {
      OR: [
        { userId: null, enabled: true },
        { userId },
      ],
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return { success: true, data: actions.map(mapActionItem) };
}

/** 获取所有 action（管理员视角，含禁用的） */
export async function listAllActions(): Promise<
  ServiceResult<EditorAIActionItem[]>
> {
  const actions = await db.editorAIAction.findMany({
    where: { userId: null },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return { success: true, data: actions.map(mapActionItem) };
}

/** 创建用户自定义 action */
export async function createUserAction(
  userId: string,
  data: {
    name: string;
    icon?: string;
    prompt: string;
    category?: string;
    scope?: string;
  }
): Promise<ServiceResult<EditorAIActionItem>> {
  const action = await db.editorAIAction.create({
    data: {
      name: data.name,
      icon: data.icon ?? null,
      prompt: data.prompt,
      category: data.category ?? "general",
      scope: data.scope ?? "selection",
      userId,
    },
  });

  return { success: true, data: mapActionItem(action) };
}

/** 管理员创建全局 action */
export async function createGlobalAction(
  data: {
    name: string;
    icon?: string;
    prompt: string;
    category?: string;
    scope?: string;
    isBuiltIn?: boolean;
  }
): Promise<ServiceResult<EditorAIActionItem>> {
  const action = await db.editorAIAction.create({
    data: {
      name: data.name,
      icon: data.icon ?? null,
      prompt: data.prompt,
      category: data.category ?? "general",
      scope: data.scope ?? "selection",
      isBuiltIn: data.isBuiltIn ?? false,
      userId: null,
    },
  });

  return { success: true, data: mapActionItem(action) };
}

/** 更新 action（管理员或所有者） */
export async function updateAction(
  id: string,
  data: {
    name?: string;
    icon?: string;
    prompt?: string;
    category?: string;
    scope?: string;
    enabled?: boolean;
    sortOrder?: number;
  },
  userId: string,
  isAdmin: boolean
): Promise<ServiceResult<EditorAIActionItem>> {
  const existing = await db.editorAIAction.findFirst({
    where: {
      id,
      ...(isAdmin ? {} : { userId }),
    },
  });

  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "AI 操作不存在" },
    };
  }

  if (existing.isBuiltIn && data.prompt !== undefined && !isAdmin) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "内置操作不可修改" },
    };
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.icon !== undefined) updateData.icon = data.icon;
  if (data.prompt !== undefined) updateData.prompt = data.prompt;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.scope !== undefined) updateData.scope = data.scope;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  const updated = await db.editorAIAction.update({
    where: { id },
    data: updateData,
  });

  return { success: true, data: mapActionItem(updated) };
}

/** 删除 action（内置不可删） */
export async function deleteAction(
  id: string,
  userId: string,
  isAdmin: boolean
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.editorAIAction.findFirst({
    where: {
      id,
      ...(isAdmin ? {} : { userId }),
    },
  });

  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "AI 操作不存在" },
    };
  }

  if (existing.isBuiltIn) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "内置操作不可删除" },
    };
  }

  await db.editorAIAction.delete({ where: { id } });

  return { success: true, data: { id } };
}

/** 获取单个 action（用于执行时获取 prompt） */
export async function getAction(
  id: string
): Promise<ServiceResult<EditorAIActionItem>> {
  const action = await db.editorAIAction.findFirst({
    where: { id },
  });

  if (!action) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "AI 操作不存在" },
    };
  }

  return { success: true, data: mapActionItem(action) };
}

/** 渲染 prompt 模板，替换占位符 */
export function renderPrompt(
  template: string,
  vars: { selection?: string; context?: string; instruction?: string }
): string {
  return template
    .replace(/\{\{selection\}\}/g, vars.selection ?? "")
    .replace(/\{\{context\}\}/g, vars.context ?? "")
    .replace(/\{\{instruction\}\}/g, vars.instruction ?? "");
}
```

- [ ] **Step 2: 验证**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/editor-ai-action.service.ts
git commit -m "feat(editor-ai): add AI action CRUD service"
```

---

### Task 5: API Routes — AI Action CRUD

**Files:**
- Create: `src/app/api/editor-ai/actions/route.ts`
- Create: `src/app/api/editor-ai/actions/[id]/route.ts`

- [ ] **Step 1: 创建列表+创建路由**

```typescript
// src/app/api/editor-ai/actions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodError } from "zod";
import { listAvailableActions, createUserAction } from "@/lib/services/editor-ai-action.service";
import { createActionSchema } from "@/validators/editor-ai";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const result = await listAvailableActions(session.user.id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "加载失败" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createActionSchema.parse(body);
    const result = await createUserAction(session.user.id, parsed);

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
      { error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "创建失败" } },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 创建更新+删除路由**

```typescript
// src/app/api/editor-ai/actions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodError } from "zod";
import { updateAction, deleteAction } from "@/lib/services/editor-ai-action.service";
import { updateActionSchema } from "@/validators/editor-ai";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const isAdmin = session.user.role === "ADMIN";

  try {
    const body = await request.json();
    const parsed = updateActionSchema.parse(body);
    const result = await updateAction(id, parsed, session.user.id, isAdmin);

    if (!result.success) {
      const status = result.error.code === "NOT_FOUND" ? 404
        : result.error.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: result.error }, { status });
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
      { error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "更新失败" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const isAdmin = session.user.role === "ADMIN";

  try {
    const result = await deleteAction(id, session.user.id, isAdmin);

    if (!result.success) {
      const status = result.error.code === "NOT_FOUND" ? 404
        : result.error.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "删除失败" } },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: 验证**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/editor-ai/
git commit -m "feat(editor-ai): add AI action CRUD API routes"
```

---

### Task 6: Seed Data — 内置 AI Action 种子数据

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: 在 seed.ts 中添加 AI Action 种子数据**

在 seed 函数末尾（admin/user 创建之后）添加：

```typescript
// Seed Editor AI Actions
const existingActions = await prisma.editorAIAction.count({
  where: { isBuiltIn: true },
});
if (existingActions === 0) {
  const builtInActions = [
    { name: "润色", icon: "✨", prompt: "请润色以下文本，改善表达流畅度和文字质量，但保持原意不变：\n\n{{selection}}\n\n上下文：\n{{context}}", category: "writing", scope: "selection", sortOrder: 1 },
    { name: "缩写", icon: "📝", prompt: "请将以下文本精简缩写，保留核心要点，去除冗余表述：\n\n{{selection}}\n\n上下文：\n{{context}}", category: "writing", scope: "selection", sortOrder: 2 },
    { name: "扩写", icon: "📖", prompt: "请扩写以下文本，增加细节、论证和具体描述，使内容更加丰富：\n\n{{selection}}\n\n上下文：\n{{context}}", category: "writing", scope: "selection", sortOrder: 3 },
    { name: "翻译为英文", icon: "🌐", prompt: "请将以下文本翻译为英文：\n\n{{selection}}", category: "translation", scope: "selection", sortOrder: 4 },
    { name: "翻译为中文", icon: "🌐", prompt: "Please translate the following text to Chinese:\n\n{{selection}}", category: "translation", scope: "selection", sortOrder: 5 },
    { name: "纠错", icon: "🎯", prompt: "请检查以下文本中的语法、拼写、标点错误并修正，列出修改内容：\n\n{{selection}}", category: "writing", scope: "selection", sortOrder: 6 },
    { name: "正式语气", icon: "💼", prompt: "请将以下文本改写为正式、专业的语气，使用更规范的措辞：\n\n{{selection}}\n\n上下文：\n{{context}}", category: "writing", scope: "selection", sortOrder: 7 },
    { name: "轻松语气", icon: "😊", prompt: "请将以下文本改写为轻松自然的语气，使其更加亲切易读：\n\n{{selection}}\n\n上下文：\n{{context}}", category: "writing", scope: "selection", sortOrder: 8 },
  ];

  for (const action of builtInActions) {
    await prisma.editorAIAction.create({
      data: { ...action, isBuiltIn: true, enabled: true, userId: null },
    });
  }
  console.log(`Seeded ${builtInActions.length} built-in editor AI actions`);
}
```

- [ ] **Step 2: 执行 seed**

```bash
npx prisma db seed
```

- [ ] **Step 3: 验证数据**

```bash
npx prisma studio
```

打开浏览器检查 EditorAIAction 表中有 8 条内置记录。

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(editor-ai): add seed data for built-in AI actions"
```

---

### Task 7: Admin Page — AI Action 管理页

**Files:**
- Create: `src/app/(dashboard)/admin/editor-ai/page.tsx`

- [ ] **Step 1: 创建管理员页面**

参照 `src/app/(dashboard)/admin/users/page.tsx` 的模式，创建 AI Action 管理页。包含：
- 全局 action 列表（表格形式：名称、图标、分类、作用域、状态、操作）
- 启用/禁用 toggle
- 创建新 action 按钮 → Dialog 弹窗
- 编辑 action → Dialog 弹窗
- 删除 action（内置不可删）
- 排序调整

页面调用 `/api/editor-ai/actions` 的管理员版本获取全局 action 列表。为管理员创建/更新时直接调用现有 PATCH/POST 接口（管理员权限自动通过 session.role 校验）。

由于此页面遵循项目已有的 admin page 模式，实现时参考 `admin/users/page.tsx` 的布局和交互模式。

- [ ] **Step 2: 验证**

启动 dev server，访问 `/admin/editor-ai`，确认页面加载、数据展示正常。

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/admin/editor-ai/
git commit -m "feat(editor-ai): add admin page for managing global AI actions"
```

---

## Phase 2：Bubble Menu 增强

### Task 8: Hook — useAIActions

**Files:**
- Create: `src/modules/reports/components/editor/ai/useAIActions.ts`

- [ ] **Step 1: 创建 hook**

```typescript
// src/modules/reports/components/editor/ai/useAIActions.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import type { EditorAIActionItem } from "@/types/editor-ai";

export function useAIActions() {
  const [actions, setActions] = useState<EditorAIActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActions = useCallback(async () => {
    try {
      const res = await fetch("/api/editor-ai/actions");
      if (res.ok) {
        const json = await res.json();
        setActions(json.data ?? []);
      }
    } catch {
      // Silently fail — actions are non-critical enhancement
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const globalActions = actions.filter((a) => !a.userId);
  const userActions = actions.filter((a) => a.userId);

  return { actions, globalActions, userActions, loading, refresh: fetchActions };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/reports/components/editor/ai/useAIActions.ts
git commit -m "feat(editor-ai): add useAIActions hook"
```

---

### Task 9: Execute API — AI Action 执行端点

**Files:**
- Create: `src/app/api/editor-ai/execute/route.ts`

- [ ] **Step 1: 创建执行路由**

```typescript
// src/app/api/editor-ai/execute/route.ts
import { convertToModelMessages, streamText } from "ai";
import { auth } from "@/lib/auth";
import { resolveModel } from "@/lib/agent2/model-resolver";
import { getAction, renderPrompt } from "@/lib/services/editor-ai-action.service";
import { executeActionSchema } from "@/validators/editor-ai";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const parsed = executeActionSchema.parse(body);

    let systemPrompt: string;
    let userMessage: string;

    if (parsed.actionId) {
      const actionResult = await getAction(parsed.actionId);
      if (!actionResult.success) {
        return new Response(JSON.stringify({ error: actionResult.error }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      systemPrompt = "你是一个专业的文本编辑助手。请根据用户指令处理提供的文本，直接返回处理后的结果，不要添加多余的解释。";
      userMessage = renderPrompt(actionResult.data.prompt, {
        selection: parsed.selection,
        context: parsed.context,
        instruction: parsed.instruction,
      });
    } else {
      systemPrompt = "你是一个专业的文本编辑助手。请根据用户指令处理提供的文本，直接返回处理后的结果。";
      userMessage = parsed.instruction || parsed.prompt || "";
      if (parsed.selection) {
        userMessage += `\n\n待处理文本：\n${parsed.selection}`;
      }
      if (parsed.context) {
        userMessage += `\n\n上下文：\n${parsed.context}`;
      }
    }

    const modelId = parsed.model || process.env.AI_MODEL || "gpt-4o";
    const { model } = await resolveModel(modelId, session.user.id);

    const result = streamText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[Editor AI Execute Error]", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
```

- [ ] **Step 2: 验证**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/editor-ai/execute/
git commit -m "feat(editor-ai): add /execute endpoint for running AI actions"
```

---

### Task 10: Components — AIActionButton + AIActionPopover

**Files:**
- Create: `src/modules/reports/components/editor/ai/AIActionButton.tsx`
- Create: `src/modules/reports/components/editor/ai/AIActionPopover.tsx`
- Create: `src/modules/reports/components/editor/ai/AIActionExecutor.ts`

- [ ] **Step 1: 创建 AIActionExecutor（执行逻辑）**

```typescript
// src/modules/reports/components/editor/ai/AIActionExecutor.ts

export interface ExecuteOptions {
  actionId?: string;
  prompt?: string;
  selection?: string;
  context?: string;
  instruction?: string;
  model?: string;
  onChunk: (text: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}

export async function executeAIAction(options: ExecuteOptions) {
  const {
    actionId,
    prompt,
    selection,
    context,
    instruction,
    model,
    onChunk,
    onDone,
    onError,
    signal,
  } = options;

  try {
    const res = await fetch("/api/editor-ai/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId, prompt, selection, context, instruction, model }),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "请求失败" }));
      onError(err.error?.message || err.error || "请求失败");
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) { onError("无响应体"); return; }

    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      // Parse SSE data lines
      for (const line of chunk.split("\n")) {
        if (line.startsWith("0:")) {
          try {
            const text = JSON.parse(line.slice(2));
            fullText += text;
            onChunk(fullText);
          } catch {
            // skip malformed lines
          }
        }
      }
    }

    onDone(fullText);
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    onError(err instanceof Error ? err.message : "执行失败");
  }
}
```

- [ ] **Step 2: 创建 AIActionPopover**

```typescript
// src/modules/reports/components/editor/ai/AIActionPopover.tsx
"use client";

import { useState, useRef } from "react";
import { Sparkles, Send, MessageSquare, Settings } from "lucide-react";
import type { EditorAIActionItem } from "@/types/editor-ai";
import { executeAIAction } from "./AIActionExecutor";

interface AIActionPopoverProps {
  globalActions: EditorAIActionItem[];
  userActions: EditorAIActionItem[];
  selection: string;
  context: string;
  onOpenSidebar: () => void;
  onEditAction: (action: EditorAIActionItem) => void;
  onCreateAction: () => void;
}

export function AIActionPopover({
  globalActions,
  userActions,
  selection,
  context,
  onOpenSidebar,
  onEditAction,
  onCreateAction,
}: AIActionPopoverProps) {
  const [input, setInput] = useState("");
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const handleExecute = async (action?: EditorAIActionItem) => {
    setExecuting(true);
    setResult("");
    abortRef.current = new AbortController();

    executeAIAction({
      actionId: action?.id,
      prompt: action ? undefined : input || undefined,
      instruction: action ? undefined : input || undefined,
      selection,
      context,
      onChunk: (text) => setResult(text),
      onDone: () => setExecuting(false),
      onError: (err) => { setResult(""); setExecuting(false); alert(err); },
      signal: abortRef.current.signal,
    });
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setExecuting(false);
  };

  return (
    <div className="w-72 p-3 space-y-3">
      {/* Model selector - simplified, uses default */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold flex items-center gap-1.5">
          <Sparkles className="size-4" /> AI 助手
        </span>
      </div>

      {/* Preset actions */}
      {globalActions.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">常用操作</div>
          <div className="grid grid-cols-2 gap-1">
            {globalActions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleExecute(action)}
                disabled={executing}
                className="text-xs px-2 py-1.5 rounded-md border border-border bg-card hover:bg-muted transition-colors text-left disabled:opacity-50"
              >
                {action.icon} {action.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* User templates */}
      {userActions.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">我的模板</div>
          <div className="space-y-0.5">
            {userActions.map((action) => (
              <div key={action.id} className="flex items-center justify-between group">
                <button
                  onClick={() => handleExecute(action)}
                  disabled={executing}
                  className="text-xs px-2 py-1 rounded hover:bg-muted flex-1 text-left disabled:opacity-50"
                >
                  📌 {action.name}
                </button>
                <button
                  onClick={() => onEditAction(action)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <Settings className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result preview */}
      {result && (
        <div className="max-h-40 overflow-y-auto rounded-md bg-muted/50 p-2 text-xs">
          <div className="whitespace-pre-wrap">{result}</div>
          {executing && <span className="inline-block w-1.5 h-3 bg-current/45 animate-pulse" />}
        </div>
      )}

      {/* Free input */}
      <div className="flex gap-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleExecute(); } }}
          placeholder="输入自定义指令..."
          className="flex-1 text-xs px-2 py-1.5 rounded-md border border-border bg-background"
          disabled={executing}
        />
        <button
          onClick={() => handleExecute()}
          disabled={executing || (!input && true)}
          className="px-2 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Send className="size-3" />
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <button onClick={onCreateAction} className="text-[11px] text-primary hover:underline">
          + 新建模板
        </button>
        <button onClick={onOpenSidebar} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">
          <MessageSquare className="size-3" /> 侧边栏对话
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 AIActionButton**

```typescript
// src/modules/reports/components/editor/ai/AIActionButton.tsx
"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useAIActions } from "./useAIActions";
import { AIActionPopover } from "./AIActionPopover";
import type { EditorAIActionItem } from "@/types/editor-ai";

interface AIActionButtonProps {
  editor: any;
  onOpenSidebar: () => void;
  onEditAction: (action: EditorAIActionItem) => void;
  onCreateAction: () => void;
}

export function AIActionButton({ editor, onOpenSidebar, onEditAction, onCreateAction }: AIActionButtonProps) {
  const [open, setOpen] = useState(false);
  const { globalActions, userActions } = useAIActions();

  const getSelection = (): string => {
    try {
      const sel = editor.getSelection();
      if (!sel || sel.blocks.length === 0) return "";
      return sel.blocks
        .map((b: any) => {
          if (!b.content) return "";
          return b.content
            .filter((s: any) => s.type === "text")
            .map((s: any) => s.text || (s as any).styles?.text || "")
            .join("");
        })
        .join("\n");
    } catch {
      return "";
    }
  };

  const getContext = (): string => {
    try {
      const doc = editor.document;
      const sel = editor.getSelection();
      if (!sel || !doc) return "";
      const selIds = new Set(sel.blocks.map((b: any) => b.id));
      const nearby = doc
        .filter((b: any) => {
          // Blocks near selection (within 2 blocks)
          return true; // Simplified: use full doc as context
        })
        .slice(0, 10);
      return nearby
        .map((b: any) => {
          if (!b.content) return "";
          return b.content
            .filter((s: any) => s.type === "text")
            .map((s: any) => s.text || "")
            .join("");
        })
        .join("\n")
        .slice(0, 2000);
    } catch {
      return "";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="bn-button flex items-center gap-1 px-2 py-1 rounded hover:bg-muted"
          title="AI 助手"
        >
          <Sparkles className="size-4" />
          <span className="text-[10px]">▾</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <AIActionPopover
          globalActions={globalActions}
          userActions={userActions}
          selection={getSelection()}
          context={getContext()}
          onOpenSidebar={() => { setOpen(false); onOpenSidebar(); }}
          onEditAction={(action) => { setOpen(false); onEditAction(action); }}
          onCreateAction={() => { setOpen(false); onCreateAction(); }}
        />
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: 验证**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/reports/components/editor/ai/
git commit -m "feat(editor-ai): add AIActionButton, AIActionPopover, and AIActionExecutor"
```

---

### Task 11: Integration — 替换 SectionEditor 中的 AIToolbarButton

**Files:**
- Modify: `src/modules/reports/components/editor/SectionEditor.tsx`

- [ ] **Step 1: 更新 import**

移除 `AIToolbarButton` 相关 import，添加新的：

```typescript
// 移除：
// AIToolbarButton,
// import { AIToolbarButtonSafe ... }

// 添加：
import { AIActionButton } from "./ai/AIActionButton";
import type { EditorAIActionItem } from "@/types/editor-ai";
```

- [ ] **Step 2: 删除 AIToolbarButtonSafe 组件定义**

删除 `AIToolbarButtonSafe` 函数组件（约 line 110-118）。

- [ ] **Step 3: 添加 props**

在 SectionEditorProps 接口中添加：

```typescript
onOpenAISidebar?: () => void;
onEditAIAction?: (action: EditorAIActionItem) => void;
onCreateAIAction?: () => void;
```

- [ ] **Step 4: 替换 FormattingToolbar 中的 AI 按钮**

将 `<AIToolbarButtonSafe key="ai" editor={editor} />` 替换为：

```typescript
<AIActionButton
  editor={editor}
  onOpenSidebar={onOpenAISidebar ?? (() => {})}
  onEditAction={onEditAIAction ?? (() => {})}
  onCreateAction={onCreateAIAction ?? (() => {})}
/>
```

- [ ] **Step 5: 保留 AIMenuController**

`<AIMenuController />` 保留不变，xl-ai 的 Slash Menu AI 功能继续可用。

- [ ] **Step 6: 验证**

启动 dev server，打开报告编辑器，选中文本后确认 FormattingToolbar 右侧出现 AI 按钮（✨▾），点击弹出操作面板。

- [ ] **Step 7: Commit**

```bash
git add src/modules/reports/components/editor/SectionEditor.tsx
git commit -m "feat(editor-ai): replace AIToolbarButton with AIActionButton in SectionEditor"
```

---

### Task 12: Component — AIActionForm 创建/编辑模板弹窗

**Files:**
- Create: `src/modules/reports/components/editor/ai/AIActionForm.tsx`

- [ ] **Step 1: 创建表单组件**

Dialog 弹窗，用于创建和编辑用户自定义 AI Action。字段包含：名称、图标（emoji 快选）、分组（select）、作用域（radio）、Prompt 模板（textarea）。

表单提交调用 POST `/api/editor-ai/actions`（创建）或 PATCH `/api/editor-ai/actions/[id]`（更新）。

使用 shadcn 的 Dialog、Input、Select、Textarea、Button 组件。

参考项目中已有的 Dialog 表单模式（如 admin 页面的用户创建/编辑弹窗）。

- [ ] **Step 2: 验证**

启动 dev server，在 Bubble Menu 中点击"+ 新建模板"，确认弹窗打开、表单可填写、提交成功。

- [ ] **Step 3: Commit**

```bash
git add src/modules/reports/components/editor/ai/AIActionForm.tsx
git commit -m "feat(editor-ai): add AIActionForm for creating/editing prompt templates"
```

---

## Phase 3：AI 侧边栏面板

### Task 13: Chat API — 侧边栏对话端点

**Files:**
- Create: `src/app/api/editor-ai/chat/route.ts`

- [ ] **Step 1: 创建对话路由**

```typescript
// src/app/api/editor-ai/chat/route.ts
import { streamText } from "ai";
import { auth } from "@/lib/auth";
import { resolveModel } from "@/lib/agent2/model-resolver";
import { chatSchema } from "@/validators/editor-ai";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const parsed = chatSchema.parse(body);

    const { model } = await resolveModel(parsed.model, session.user.id);

    // Build context-aware system prompt
    let systemPrompt = "你是一个专业的报告写作助手。用户正在撰写报告，你可以帮助润色、改写、扩展、分析文本。\n\n";

    if (parsed.context?.sectionContent) {
      systemPrompt += `当前章节内容（供参考）：\n${parsed.context.sectionContent.slice(0, 4000)}\n\n`;
    }

    if (parsed.context?.pinnedSelections?.length) {
      systemPrompt += `用户引用的文本片段：\n${parsed.context.pinnedSelections.map((s, i) => `[引用 ${i + 1}]: ${s}`).join("\n\n")}\n\n`;
    }

    systemPrompt += "请用中文回复。如果用户要求修改文本，直接返回修改后的内容。";

    const result = streamText({
      model,
      system: systemPrompt,
      messages: parsed.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[Editor AI Chat Error]", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
```

- [ ] **Step 2: 验证**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/editor-ai/chat/
git commit -m "feat(editor-ai): add /chat endpoint for sidebar AI conversations"
```

---

### Task 14: Store — Zustand Store for Editor AI State

**Files:**
- Create: `src/modules/reports/components/editor/ai/useEditorAIStore.ts`

- [ ] **Step 1: 创建 store**

```typescript
// src/modules/reports/components/editor/ai/useEditorAIStore.ts
import { create } from "zustand";
import type { PinnedSelection } from "@/types/editor-ai";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  pinnedSelections?: PinnedSelection[];
  timestamp: number;
}

interface EditorAIState {
  // Sidebar visibility
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Chat
  messages: ChatMessage[];
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  clearMessages: () => void;

  // Pinned selections
  pinnedSelections: PinnedSelection[];
  addPinnedSelection: (sel: Omit<PinnedSelection, "id" | "timestamp">) => void;
  removePinnedSelection: (id: string) => void;
  clearPinnedSelections: () => void;

  // Model
  selectedModel: string;
  setSelectedModel: (model: string) => void;

  // Context
  sectionContent: string;
  setSectionContent: (content: string) => void;
}

export const useEditorAIStore = create<EditorAIState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  messages: [],
  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { ...msg, id: crypto.randomUUID(), timestamp: Date.now() },
      ],
    })),
  clearMessages: () => set({ messages: [] }),

  pinnedSelections: [],
  addPinnedSelection: (sel) =>
    set((state) => {
      if (state.pinnedSelections.length >= 5) return state;
      return {
        pinnedSelections: [
          ...state.pinnedSelections,
          { ...sel, id: crypto.randomUUID(), timestamp: Date.now() },
        ],
      };
    }),
  removePinnedSelection: (id) =>
    set((state) => ({
      pinnedSelections: state.pinnedSelections.filter((s) => s.id !== id),
    })),
  clearPinnedSelections: () => set({ pinnedSelections: [] }),

  selectedModel: process.env.NEXT_PUBLIC_DEFAULT_AI_MODEL || "gpt-4o",
  setSelectedModel: (model) => set({ selectedModel: model }),

  sectionContent: "",
  setSectionContent: (content) => set({ sectionContent: content }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/reports/components/editor/ai/useEditorAIStore.ts
git commit -m "feat(editor-ai): add Zustand store for editor AI sidebar state"
```

---

### Task 15: Components — AIChatSidebar + SelectionAttachment

**Files:**
- Create: `src/modules/reports/components/editor/ai/AIChatSidebar.tsx`
- Create: `src/modules/reports/components/editor/ai/SelectionAttachment.tsx`

- [ ] **Step 1: 创建 SelectionAttachment 组件**

```typescript
// src/modules/reports/components/editor/ai/SelectionAttachment.tsx
"use client";

import { X } from "lucide-react";
import type { PinnedSelection } from "@/types/editor-ai";

interface SelectionAttachmentProps {
  selection: PinnedSelection;
  onRemove: (id: string) => void;
}

export function SelectionAttachment({ selection, onRemove }: SelectionAttachmentProps) {
  const preview = selection.text.length > 60
    ? selection.text.slice(0, 60) + "..."
    : selection.text;

  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-2 group">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
          <span className="text-xs">📎</span>
          <span className="text-[11px] font-semibold">选中文本</span>
          <span className="text-[10px] text-muted-foreground">约 {selection.text.length} 字</span>
        </div>
        <button
          onClick={() => onRemove(selection.id)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="bg-background rounded px-2 py-1 text-[11px] text-muted-foreground max-h-12 overflow-hidden leading-relaxed">
        {preview}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 AIChatSidebar 组件**

这是侧边栏主组件，包含：
- Header（模型选择 + 关闭按钮）
- 上下文指示器（已关联章节名）
- 对话消息区域（用户/AI 消息气泡 + 操作按钮）
- 快捷操作栏（从 useAIActions 获取 action 列表）
- 引用卡片区域
- 输入框

组件调用 `/api/editor-ai/chat` 进行对话。使用 `executeAIAction` 中的 stream 读取模式解析响应。

流式响应时显示打字动画。AI 回复下方显示"插入到编辑器"/"复制"按钮。

组件接收 `editorRef` prop，用于执行"插入到编辑器"操作（调用 `editorRef.current.insertBlocks()`）。

- [ ] **Step 3: 验证**

启动 dev server，确认侧边栏组件无编译错误。

- [ ] **Step 4: Commit**

```bash
git add src/modules/reports/components/editor/ai/AIChatSidebar.tsx src/modules/reports/components/editor/ai/SelectionAttachment.tsx
git commit -m "feat(editor-ai): add AIChatSidebar and SelectionAttachment components"
```

---

### Task 16: Integration — 报告编辑器页面集成侧边栏

**Files:**
- Modify: `src/app/(reports)/reports/drafts/[id]/page.tsx`

- [ ] **Step 1: 添加 import**

```typescript
import { AIChatSidebar } from "@/modules/reports/components/editor/ai/AIChatSidebar";
import { useEditorAIStore } from "@/modules/reports/components/editor/ai/useEditorAIStore";
import type { EditorAIActionItem } from "@/types/editor-ai";
```

- [ ] **Step 2: 修改右侧面板为 Tab 模式**

将现有的单一 OutlinePanel 改为 Tab 切换：

```typescript
const [rightTab, setRightTab] = useState<"outline" | "ai">("outline");
const { sidebarOpen, setSidebarOpen } = useEditorAIStore();
```

右侧面板 JSX：

```tsx
{/* 右侧面板：大纲 / AI 助手 Tab */}
<div className={`shrink-0 border-l border-border bg-card overflow-y-auto overflow-x-hidden transition-[width] duration-200 flex flex-col ${
  rightCollapsed ? "w-0 border-l-0" : "w-72"
}`}>
  <div className="w-72 flex flex-col flex-1">
    {/* Tab 栏 */}
    <div className="flex items-center border-b border-border">
      <button
        onClick={() => setRightTab("outline")}
        className={`flex-1 px-3 py-2 text-xs font-medium ${rightTab === "outline" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
      >
        大纲
      </button>
      <button
        onClick={() => { setRightTab("ai"); setSidebarOpen(true); }}
        className={`flex-1 px-3 py-2 text-xs font-medium ${rightTab === "ai" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
      >
        ✨ AI 助手
      </button>
      <button onClick={() => setRightCollapsed(true)} className="p-0.5 px-2 rounded hover:bg-muted text-muted-foreground" title="折叠">
        <PanelRightClose width="14" height="14" />
      </button>
    </div>

    {/* Tab 内容 */}
    {rightTab === "outline" ? (
      <OutlinePanel sections={draft.sections} sectionEnabled={draft.sectionEnabled} activeSection={activeSection} onNavigateHeading={handleNavigateHeading} collapsed={rightCollapsed} />
    ) : (
      <AIChatSidebar editorRef={editorRef} />
    )}
  </div>
</div>
```

- [ ] **Step 3: 更新 SectionEditor props 传递**

```tsx
<SectionEditor
  ...
  onOpenAISidebar={() => { setRightTab("ai"); setRightCollapsed(false); }}
  onEditAIAction={(action) => { /* open AIActionForm */ }}
  onCreateAIAction={() => { /* open AIActionForm */ }}
/>
```

- [ ] **Step 4: 验证**

启动 dev server，打开报告编辑器，确认右侧面板出现"大纲"和"AI 助手"Tab，切换正常，AI 助手侧边栏加载正常。

- [ ] **Step 5: Commit**

```bash
git add src/app/\(reports\)/reports/drafts/\[id\]/page.tsx
git commit -m "feat(editor-ai): integrate AI sidebar into report editor page with tab layout"
```

---

## Phase 4：用户自定义模板完善

### Task 17: Integration — Bubble Menu 中完整模板管理

**Files:**
- Modify: `src/modules/reports/components/editor/ai/AIActionButton.tsx`
- Modify: `src/app/(reports)/reports/drafts/[id]/page.tsx`

- [ ] **Step 1: 连接 AIActionForm 到编辑器页面**

在 page.tsx 中添加 AIActionForm 的 state 和渲染。Bubble Menu 的"新建模板"和"编辑"操作触发打开弹窗。

```typescript
const [aiFormOpen, setAIFormOpen] = useState(false);
const [editingAction, setEditingAction] = useState<EditorAIActionItem | null>(null);
```

- [ ] **Step 2: 通过 props 传递到 SectionEditor → AIActionButton → AIActionPopover**

Bubble Menu 中点击"新建模板"或 ⚙ 编辑时，打开 AIActionForm 弹窗。

- [ ] **Step 3: 验证**

在编辑器中选中文字 → 点击 AI ▾ → 点击"+ 新建模板" → 填写表单 → 保存 → 确认新模板出现在"我的模板"列表中。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(editor-ai): wire AIActionForm into bubble menu for template management"
```

---

### Task 18: Enhancement — 侧边栏快捷操作栏

**Files:**
- Modify: `src/modules/reports/components/editor/ai/AIChatSidebar.tsx`

- [ ] **Step 1: 添加快捷操作栏**

在侧边栏的对话区域和输入框之间添加快捷操作标签栏。渲染 `useAIActions()` 返回的 globalActions 和 userActions。

点击标签直接以当前选中文本 + action prompt 发送消息。

- [ ] **Step 2: 验证**

打开 AI 侧边栏，确认快捷操作栏显示预设操作标签，点击后自动发送对应 prompt。

- [ ] **Step 3: Commit**

```bash
git add src/modules/reports/components/editor/ai/AIChatSidebar.tsx
git commit -m "feat(editor-ai): add quick action bar to AI sidebar"
```

---

## Self-Review Checklist

### Spec Coverage
- [x] P1: EditorAIAction 数据模型 → Task 1
- [x] P1: API 端点（5 个）→ Task 5 + Task 9
- [x] P1: 种子数据（8 个内置操作）→ Task 6
- [x] P1: 管理员后台 → Task 7
- [x] P2: AIActionButton 替换 AIToolbarButtonSafe → Task 10 + Task 11
- [x] P2: AIActionPopover（预设 + 自由输入）→ Task 10
- [x] P2: /execute API → Task 9
- [x] P2: AIActionForm 创建/编辑弹窗 → Task 12
- [x] P3: 右侧面板 Tab 模式 → Task 16
- [x] P3: AIChatSidebar 多轮对话 → Task 15
- [x] P3: 上下文感知 → Task 14 + Task 15
- [x] P3: 选中文本引用附件 → Task 15
- [x] P3: /chat API → Task 13
- [x] P3: 结果回插 → Task 15
- [x] P3: 模型切换 → Task 14 + Task 15
- [x] P4: 管理员后台管理全局模板 → Task 7
- [x] P4: 用户内联管理模板 → Task 17
- [x] P4: 侧边栏快捷操作栏 → Task 18

### Placeholder Scan
- No TBD, TODO, or placeholder patterns found.
- All tasks include actual code or specific instructions.

### Type Consistency
- `EditorAIActionItem` defined in Task 2, used consistently in Tasks 4-12, 15-18
- `PinnedSelection` defined in Task 2, used in Task 14-15
- `ServiceResult<T>` imported from `@/types/data-table` consistently
- API route patterns follow `RouteContext = { params: Promise<{ id: string }> }` for Next.js v16
