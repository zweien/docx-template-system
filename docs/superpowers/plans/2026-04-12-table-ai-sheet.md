# 数据表 AI 助手右侧抽屉 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将数据表详情页的 AI 助手按钮从跳转独立页面改为右侧 Sheet 抽屉内嵌 agent2 对话。

**Architecture:** 在 `table-detail-content.tsx` 中用 Sheet 包裹 ChatArea 组件，打开时创建新对话，ChatArea 通过可选 props 适配嵌入式场景（去掉 sidebar 切换）。后端 chat route 从 body 提取 `tableId` 注入数据表上下文到 system prompt。

**Tech Stack:** React, Sheet (Base UI Dialog), ChatArea (agent2), Zod, AI SDK

---

## 文件结构

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `src/components/agent2/chat-area.tsx` | ChatArea props 改为可选，支持 `tableId` |
| 修改 | `src/components/data/table-detail-content.tsx` | 按钮→Sheet 触发，内嵌 ChatArea |
| 修改 | `src/validators/agent2.ts` | `chatRequestSchema` 增加 `tableId` 可选字段 |
| 修改 | `src/app/api/agent2/conversations/[id]/chat/route.ts` | 提取 `tableId`，传递给 `buildSystemPrompt` |
| 修改 | `src/lib/agent2/context-builder.ts` | `buildSystemPrompt` 接受 `tableId` 参数，注入当前表上下文 |

---

### Task 1: ChatArea props 适配嵌入式场景

**Files:**
- Modify: `src/components/agent2/chat-area.tsx:39-45` (接口定义)
- Modify: `src/components/agent2/chat-area.tsx:86` (解构参数)
- Modify: `src/components/agent2/chat-area.tsx:114-118` (useChat body)
- Modify: `src/components/agent2/chat-area.tsx:254-274` (header 渲染)

- [ ] **Step 1: 修改 ChatAreaProps 接口，让 sidebar 相关 props 可选，新增 tableId**

将 `src/components/agent2/chat-area.tsx` 的接口改为：

```typescript
interface ChatAreaProps {
  conversationId: string
  onToggleSidebar?: () => void
  sidebarCollapsed?: boolean
  onMobileMenuOpen?: () => void
  defaultModel?: string
  tableId?: string
}
```

- [ ] **Step 2: 更新函数签名和解构**

将第 86 行的解构改为：

```typescript
export function ChatArea({ conversationId, onToggleSidebar, sidebarCollapsed, onMobileMenuOpen, defaultModel, tableId }: ChatAreaProps) {
```

- [ ] **Step 3: 在 useChat body 中传入 tableId**

找到 `useChat` 的 `transport` 配置（约第 116-118 行），在 body 中加入 `tableId`：

```typescript
transport: new DefaultChatTransport({
  api: `/api/agent2/conversations/${conversationId}/chat`,
  body: { model, ...(tableId ? { tableId } : {}) },
}),
```

- [ ] **Step 4: header 条件渲染 sidebar 按钮**

将 header 区域（约第 254-274 行）的 sidebar 按钮改为条件渲染：

```tsx
{/* Header */}
<div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
  {onToggleSidebar && (
    <Button variant="ghost" size="icon-xs" className="hidden md:inline-flex" onClick={onToggleSidebar}>
      {mounted ? (
        sidebarCollapsed ? (
          <PanelLeft className="size-4" />
        ) : (
          <PanelLeftClose className="size-4" />
        )
      ) : (
        <PanelLeftClose className="size-4" />
      )}
    </Button>
  )}
  {onMobileMenuOpen && (
    <Button variant="ghost" size="icon-xs" className="md:hidden" onClick={onMobileMenuOpen}>
      <PanelLeft className="size-4" />
    </Button>
  )}
  <span className="text-sm font-medium truncate">AI 助手</span>
  <span className="text-xs text-muted-foreground">{modelName}</span>
</div>
```

- [ ] **Step 5: 提交**

```bash
git add src/components/agent2/chat-area.tsx
git commit -m "refactor(agent2): make ChatArea sidebar props optional, add tableId prop"
```

---

### Task 2: 后端 chat route 支持 tableId 上下文

**Files:**
- Modify: `src/validators/agent2.ts:13-23` (chatRequestSchema)
- Modify: `src/lib/agent2/context-builder.ts:13` (buildSystemPrompt 签名)
- Modify: `src/lib/agent2/context-builder.ts:19-58` (tableContext 逻辑)
- Modify: `src/app/api/agent2/conversations/[id]/chat/route.ts:71` (调用处)

- [ ] **Step 1: chatRequestSchema 增加 tableId 可选字段**

修改 `src/validators/agent2.ts` 第 13-23 行：

```typescript
export const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["user", "assistant", "system"]),
      parts: z.array(z.unknown()),
      metadata: z.unknown().optional(),
    })
  ),
  model: z.string().min(1),
  tableId: z.string().optional(),
});
```

- [ ] **Step 2: buildSystemPrompt 接受 tableId 参数**

修改 `src/lib/agent2/context-builder.ts` 的 `buildSystemPrompt` 函数签名和实现。当传入 `tableId` 时，在通用数据表概览之前插入当前表的详细信息：

```typescript
export async function buildSystemPrompt(tableId?: string): Promise<string> {
  // Check cache (only when no tableId, since tableId-specific prompts differ)
  if (!tableId && syspromptCache && Date.now() < syspromptCache.expiresAt) {
    return syspromptCache.text;
  }

  let currentTableContext = "";
  let tableContext = "";
  let mcpContext = "";

  // When tableId is provided, inject current table details at the top
  if (tableId) {
    try {
      const schema = await getTableSchema(tableId);
      if (schema.success) {
        const t = schema.data;
        currentTableContext = `\n## 当前数据表（用户正在查看的页面）\n`;
        currentTableContext += `表名：${t.name}（ID: ${t.id}）\n`;
        if (t.description) currentTableContext += `描述：${t.description}\n`;
        currentTableContext += `记录数：${t.recordCount}\n`;
        currentTableContext += "字段：\n";
        for (const f of t.fields) {
          let desc = `- ${f.label} (${f.key}, 类型: ${f.type})`;
          if (f.required) desc += " [必填]";
          if (Array.isArray(f.options) && f.options.length) desc += ` [选项: ${f.options.join("/")}]`;
          if (f.relationTo) desc += ` [关联→${f.relationTo}]`;
          currentTableContext += desc + "\n";
        }
        currentTableContext += "\n用户当前正在查看此数据表，你应优先针对此表进行问答和操作。\n";
      }
    } catch {
      // 获取当前表信息失败不影响系统提示
    }
  }

  // ... MCP context logic unchanged ...

  try {
    const { getEnabledMcpServers } = await import("@/lib/services/agent2-mcp.service");
    const serversResult = await getEnabledMcpServers();
    if (serversResult.success && serversResult.data.length > 0) {
      mcpContext = "\n## 可用的 MCP 外部工具\n";
      mcpContext += "你还可以使用以下 MCP 外部工具来获取外部数据。工具名称格式为 `mcp__服务器名__工具名`。\n\n";
      for (const server of serversResult.data) {
        const config = server.config as Record<string, unknown>;
        mcpContext += `- **${server.name}** (${server.transportType}): ${config.url || config.command || ""}\n`;
      }
      mcpContext += "\n提示：使用 MCP 工具前，先了解该工具的参数要求。MCP 工具名称前缀为 `mcp__`。\n";
    }
  } catch {
    // MCP 上下文获取失败不影响系统提示
  }

  // ... general table overview unchanged ...
  try {
    const tablesResult = await listTables();
    if (tablesResult.success && tablesResult.data.length > 0) {
      tableContext = "\n## 当前系统数据表概览\n";
      for (const t of tablesResult.data.slice(0, 5)) {
        const schema = await getTableSchema(t.id);
        if (schema.success) {
          tableContext += `\n### ${t.name}（ID: ${t.id}，${t.recordCount} 条记录）\n`;
          tableContext += "字段：" + schema.data.fields
            .map(f => {
              let desc = `${f.label}(${f.type})`;
              if (f.required) desc += "[必填]";
              if (f.options?.length) desc += `[选项: ${f.options.join("/")}]`;
              if ((f as Record<string, unknown>).relationTo) desc += `[关联→${(f as Record<string, unknown>).relationTo}]`;
              return desc;
            })
            .join("、") + "\n";
        }
      }
      tableContext += "\n提示：使用 getTableSchema(tableId) 可获取完整字段定义。如需查询其他表，先用 listTables() 查看所有表。\n";
    }
  } catch {
    // 动态上下文获取失败时不影响系统正常运行
  }

  const text = `你是一个系统集成 AI 助手，能够操作本系统的数据表、模板和记录。

## 能力范围
- 查询和管理数据表（查看、搜索、聚合）
- 创建、更新、删除记录
- 查看和生成文档（基于模板）
- 生成数据可视化图表
- 获取当前时间
- 通过 DOI 查询并导入论文（fetchPaperByDOI）
- 解析用户输入的论文文本并导入（parsePaperText）
- 导入论文到论文表，自动匹配/创建作者（importPaper）

## 工作原则
1. 先查询再操作 — 在修改数据前，先确认目标记录或数据
2. 确认重要操作 — 创建、更新、删除操作需要用户确认
3. 解释操作结果 — 每次操作后清晰说明结果
4. 主动提供帮助 — 根据用户意图推荐合适的工具
5. 批量导入 — 用户上传文件后，解析内容并使用 batchCreateRecords 批量导入
6. 论文导入流程 — 用户提到"导入论文"时：先用 parsePaperText 解析文本或 fetchPaperByDOI 获取 DOI 信息，展示结果让用户确认，再调用 importPaper 导入。逐条确认。
7. 确认流程 — 调用需要确认的工具（createRecord, updateRecord, deleteRecord, batchDeleteRecords, importPaper 等）时：
   - 工具会返回 { _needsConfirm: true }，表示操作已暂停等待用户确认
   - 收到此响应后，你必须停止生成，不要再次调用相同或类似的工具
   - 简短告知用户操作正在等待确认，用户可以在确认框中查看详情
   - 等待用户在界面中确认或拒绝后再继续
   - 当用户发送"确认执行"时，如果历史消息中该工具的输出包含 { success: true, message: "..." }，说明操作已被用户确认并成功执行，直接总结结果即可，绝对不要再次调用该工具
8. 删除操作流程 — 当用户要求删除记录时：
   - 如果用户提供了明确的记录 ID，直接调用 deleteRecord
   - 如果用户提供了模糊描述（如"删除论文 Attention Is All You Need"），先用 searchRecords 查询确认记录
   - deleteRecord 调用后系统会自动在确认框中展示记录详情
   - 不要反复重试调用，等待用户确认即可
${currentTableContext}
${tableContext}
${mcpContext}
## 回答语言
默认使用中文回答，除非用户明确要求其他语言。`;

  // Cache only when no tableId
  if (!tableId) {
    syspromptCache = { text, expiresAt: Date.now() + SYSPROMPT_TTL };
  }
  return text;
}
```

注意：这里完整重写了 `buildSystemPrompt` 函数体，但核心逻辑不变，只在原有基础上：
1. 函数签名增加 `tableId?: string` 参数
2. 新增 `currentTableContext` 段落（当 tableId 存在时注入当前表详情）
3. system prompt 模板中插入 `${currentTableContext}`
4. 带 tableId 的调用不缓存（因为每个表不同）

- [ ] **Step 3: chat route 提取 tableId 并传给 buildSystemPrompt**

修改 `src/app/api/agent2/conversations/[id]/chat/route.ts` 第 71 行：

```typescript
// 原来：
const systemPrompt = await buildSystemPrompt();
// 改为：
const systemPrompt = await buildSystemPrompt(validated.tableId);
```

- [ ] **Step 4: 验证类型检查通过**

```bash
npx tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 5: 提交**

```bash
git add src/validators/agent2.ts src/lib/agent2/context-builder.ts src/app/api/agent2/conversations/[id]/chat/route.ts
git commit -m "feat(agent2): support tableId in chat request for table context injection"
```

---

### Task 3: table-detail-content 集成 Sheet + ChatArea

**Files:**
- Modify: `src/components/data/table-detail-content.tsx`

- [ ] **Step 1: 替换 AI 助手按钮为 Sheet 抽屉**

完整重写 `src/components/data/table-detail-content.tsx`：

```tsx
"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Bot } from "lucide-react";
import { RecordTable } from "@/components/data/record-table";
import { ViewSwitcher } from "@/components/data/view-switcher";
import { RecordDetailDrawer } from "@/components/data/record-detail-drawer";
import { ChatArea } from "@/components/agent2/chat-area";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
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

  // AI Sheet state
  const [aiOpen, setAiOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const handleAiOpen = useCallback(() => {
    if (!aiOpen) {
      // Opening: create new conversation
      void fetch("/api/agent2/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `数据表: ${table.name}` }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setConversationId(data.data.id);
            setAiOpen(true);
          }
        })
        .catch(() => {
          // failed to create conversation
        });
    } else {
      setAiOpen(false);
    }
  }, [aiOpen, table.name]);

  const handleAiClose = useCallback((open: boolean) => {
    if (!open) {
      setAiOpen(false);
      // Don't reset conversationId immediately — ChatArea needs it during close animation
      // It will be replaced on next open anyway
    }
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-6">
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
          <Button variant="outline" size="sm" onClick={handleAiOpen}>
            <Bot className="h-4 w-4 mr-2" />
            AI 助手
          </Button>

          {isAdmin && (
            <>
              <Link href={`/data/${tableId}/import`}>
                <Button variant="outline" size="sm">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-1"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" x2="12" y1="3" y2="15" />
                  </svg>
                  导入
                </Button>
              </Link>
              <Link href={`/data/${tableId}/fields`}>
                <Button variant="outline" size="sm">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-1"
                  >
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

      {/* Stats & View Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1 text-zinc-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <line x1="3" x2="21" y1="9" y2="9" />
              <line x1="9" x2="9" y1="21" y2="9" />
            </svg>
            {table.fieldCount} 个字段
          </div>
          <div className="flex items-center gap-1 text-zinc-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
            {table.recordCount} 条记录
          </div>
        </div>
        <ViewSwitcher currentType={viewType} onTypeChange={setViewType} />
      </div>

      <Separator />

      {/* Record Table */}
      <RecordTable
        tableId={tableId}
        fields={table.fields}
        isAdmin={isAdmin}
        viewType={viewType}
        onOpenDetail={(recordId) => {
          setDetailRecordId(recordId);
          setDetailOpen(true);
        }}
      />

      {/* Record Detail Drawer */}
      <RecordDetailDrawer
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDetailOpen(false);
            setDetailRecordId(null);
          }
        }}
        recordId={detailRecordId}
        tableId={tableId}
        fields={table.fields}
        isAdmin={isAdmin}
      />

      {/* AI Assistant Sheet */}
      <Sheet open={aiOpen} onOpenChange={handleAiClose}>
        <SheetContent side="right" className="sm:max-w-lg w-full p-0" showCloseButton={false}>
          {conversationId && (
            <ChatArea
              conversationId={conversationId}
              tableId={tableId}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

关键改动点：
- 移除了 `<Link href={/ai-agent?tableId=${tableId}}>` 包裹，改为普通 `<Button onClick={handleAiOpen}>`
- 新增 `aiOpen` 和 `conversationId` 状态
- `handleAiOpen` 在打开时先创建对话，成功后设置 conversationId 并打开 Sheet
- Sheet 使用 `sm:max-w-lg w-full`（桌面端更宽，移动端全屏）
- `showCloseButton={false}` 因为 ChatArea 自带关闭按钮
- SheetContent `p-0` 去掉内边距，让 ChatArea 占满

- [ ] **Step 2: 验证类型检查通过**

```bash
npx tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 3: 提交**

```bash
git add src/components/data/table-detail-content.tsx
git commit -m "feat(data): replace AI assistant link with Sheet drawer embedding ChatArea"
```

---

### Task 4: 验证与最终提交

- [ ] **Step 1: 运行 lint 检查**

```bash
npm run lint
```

Expected: 无 lint 错误

- [ ] **Step 2: 运行构建确认无错误**

```bash
npm run build
```

Expected: 构建成功

- [ ] **Step 3: 手动验证**

启动 dev server (`npm run dev`)，验证以下场景：
1. 打开任意数据表详情页
2. 点击「AI 助手」按钮 → 右侧 Sheet 滑出，不离开页面
3. 抽屉内显示 agent2 对话界面，可发送消息
4. AI 回复能感知当前数据表上下文
5. 关闭抽屉后重新打开，创建新对话
6. 移动端适配（全屏 Sheet）

- [ ] **Step 4: 创建分支并提交全部改动（如尚未在分支上）**

```bash
git checkout -b feature/issue-40-ai-sheet
git push -u origin feature/issue-40-ai-sheet
```
