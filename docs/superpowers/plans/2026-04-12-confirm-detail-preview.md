# 确认工具详情预取 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让确认框展示操作对象的详情（如论文标题、作者），同时通过 system prompt 指导 AI 正确处理确认流程，避免反复重试。

**Architecture:** 后端 `wrapConfirm` 在创建确认 token 后预取操作对象详情，通过 `detailPreview` 字段传给前端；前端确认框根据 `detailPreview` 渲染结构化详情卡片，无详情时回退到 JSON 展示；system prompt 增加确认流程和删除操作指导。

**Tech Stack:** TypeScript, React, AI SDK (tool), Zod, Vitest, Testing Library

---

## File Structure

| 操作 | 文件 | 职责 |
|------|------|------|
| Modify | `src/lib/agent2/tools.ts` | 添加 `DetailPreview` 接口、`fetchDetailPreview` 函数、更新 `wrapConfirm` 返回值 |
| Modify | `src/lib/agent2/context-builder.ts` | system prompt 增加确认流程指导 |
| Modify | `src/components/agent2/message-parts.tsx` | 扩展 `ConfirmToolOutput`/`ConfirmState`、确认工具加 `defaultOpen` |
| Modify | `src/components/agent2/tool-confirm-dialog.tsx` | 接收并渲染 `detailPreview` 详情卡片 |
| Create | `src/lib/agent2/detail-preview.test.ts` | `fetchDetailPreview` 的单元测试 |

---

### Task 1: 添加 `fetchDetailPreview` 函数及测试

**Files:**
- Create: `src/lib/agent2/detail-preview.ts`
- Create: `src/lib/agent2/detail-preview.test.ts`
- Reference: `src/lib/agent2/tool-helpers.ts` (getRecord, getTemplateDetail)

- [ ] **Step 1: 创建测试文件 `src/lib/agent2/detail-preview.test.ts`**

```typescript
import { describe, expect, it, vi } from "vitest"
import { fetchDetailPreview, formatFieldValue, extractRecordTitle } from "./detail-preview"

// Mock tool-helpers
vi.mock("./tool-helpers", () => ({
  getRecord: vi.fn(),
  getTemplateDetail: vi.fn(),
}))

import { getRecord, getTemplateDetail } from "./tool-helpers"

const mockGetRecord = vi.mocked(getRecord)
const mockGetTemplateDetail = vi.mocked(getTemplateDetail)

describe("formatFieldValue", () => {
  it("字符串直接返回", () => {
    expect(formatFieldValue("hello")).toBe("hello")
  })

  it("数字转字符串", () => {
    expect(formatFieldValue(42)).toBe("42")
  })

  it("null/undefined 返回 -", () => {
    expect(formatFieldValue(null)).toBe("-")
    expect(formatFieldValue(undefined)).toBe("-")
  })

  it("数组用逗号连接", () => {
    expect(formatFieldValue(["a", "b", "c"])).toBe("a, b, c")
  })

  it("对象 JSON 序列化", () => {
    expect(formatFieldValue({ key: "val" })).toBe('{"key":"val"}')
  })
})

describe("extractRecordTitle", () => {
  it("优先使用 title_en", () => {
    expect(extractRecordTitle({ title_en: "Hello", title_cn: "你好", id: "1", tableId: "t1" }))
      .toBe("Hello")
  })

  it("其次使用 title_cn", () => {
    expect(extractRecordTitle({ title_cn: "你好", id: "1", tableId: "t1" }))
      .toBe("你好")
  })

  it("使用第一个非空字符串字段", () => {
    expect(extractRecordTitle({ name: "Alice", age: 30, id: "1", tableId: "t1" }))
      .toBe("Alice")
  })

  it("无可用字段时返回 记录 ID", () => {
    expect(extractRecordTitle({ id: "rec-123", tableId: "t1", age: 30 }))
      .toBe("记录 rec-123")
  })
})

describe("fetchDetailPreview", () => {
  it("deleteRecord 返回记录详情", async () => {
    mockGetRecord.mockResolvedValueOnce({
      success: true,
      data: { id: "r1", tableId: "t1", title_en: "Attention Is All You Need", year: 2017 },
    })

    const result = await fetchDetailPreview("deleteRecord", { recordId: "r1" })

    expect(result).toEqual({
      title: "Attention Is All You Need",
      type: "record",
      fields: expect.arrayContaining([
        { label: "title_en", value: "Attention Is All You Need" },
        { label: "year", value: "2017" },
      ]),
    })
  })

  it("deleteRecord 记录不存在时返回 null", async () => {
    mockGetRecord.mockResolvedValueOnce({
      success: false,
      error: { code: "NOT_FOUND", message: "记录不存在" },
    })

    const result = await fetchDetailPreview("deleteRecord", { recordId: "bad-id" })
    expect(result).toBeNull()
  })

  it("importPaper 返回论文详情", async () => {
    const result = await fetchDetailPreview("importPaper", {
      paperData: { title_en: "Test Paper", title_cn: "测试论文", publish_year: 2024, venue_name: "ICML", doi: "10.1234/test" },
      authors: [
        { name: "Alice", author_order: 1, is_first_author: "Y", is_corresponding_author: "N" },
        { name: "Bob", author_order: 2, is_first_author: "N", is_corresponding_author: "Y" },
      ],
    })

    expect(result).toEqual({
      title: "论文: Test Paper",
      type: "paper",
      fields: [
        { label: "英文标题", value: "Test Paper" },
        { label: "中文标题", value: "测试论文" },
        { label: "年份", value: "2024" },
        { label: "期刊/会议", value: "ICML" },
        { label: "DOI", value: "10.1234/test" },
      ],
      summary: "共 2 位作者: Alice, Bob",
    })
  })

  it("generateDocument 返回模板详情", async () => {
    mockGetTemplateDetail.mockResolvedValueOnce({
      success: true,
      data: {
        id: "tpl1",
        name: "论文报告",
        description: null,
        status: "PUBLISHED",
        placeholders: [
          { id: "p1", key: "title", label: "标题", inputType: "text", required: true, defaultValue: null },
        ],
      },
    })

    const result = await fetchDetailPreview("generateDocument", {
      templateId: "tpl1",
      formData: { title: "My Paper" },
    })

    expect(result).toEqual({
      title: "模板: 论文报告",
      type: "template",
      fields: [{ label: "title", value: "My Paper" }],
    })
  })

  it("batchDeleteRecords 返回批量预览（限制 10 条）", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `r${i}`)
    for (let i = 0; i < 10; i++) {
      mockGetRecord.mockResolvedValueOnce({
        success: true,
        data: { id: `r${i}`, tableId: "t1", title_en: `Paper ${i}` },
      })
    }

    const result = await fetchDetailPreview("batchDeleteRecords", { recordIds: ids })

    expect(result?.recordCount).toBe(12)
    expect(result?.items).toHaveLength(10)
    expect(result?.title).toBe("批量操作 12 条记录")
  })

  it("未知工具返回 null", async () => {
    const result = await fetchDetailPreview("unknownTool", {})
    expect(result).toBeNull()
  })

  it("异常时返回 null", async () => {
    mockGetRecord.mockRejectedValueOnce(new Error("DB error"))
    const result = await fetchDetailPreview("deleteRecord", { recordId: "r1" })
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/lib/agent2/detail-preview.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 创建 `src/lib/agent2/detail-preview.ts`**

```typescript
// src/lib/agent2/detail-preview.ts
import * as helpers from "./tool-helpers"

export interface DetailPreview {
  title: string
  type: "record" | "paper" | "template" | "code" | "generic"
  fields?: Array<{ label: string; value: string }>
  summary?: string
  recordCount?: number
  items?: Array<{ id: string; label: string }>
}

/** 格式化字段值为可读字符串 */
export function formatFieldValue(value: unknown): string {
  if (value == null) return "-"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(", ")
  return JSON.stringify(value)
}

/** 从记录数据中提取可读标题 */
export function extractRecordTitle(data: Record<string, unknown>): string {
  // 优先使用常见标题字段
  for (const key of ["title_en", "title_cn", "name", "title"]) {
    const val = data[key]
    if (typeof val === "string" && val.trim()) return val.trim()
  }
  // 使用第一个非空字符串字段
  for (const [key, val] of Object.entries(data)) {
    if (key === "id" || key === "tableId") continue
    if (typeof val === "string" && val.trim()) return val.trim()
  }
  return `记录 ${data.id ?? "未知"}`
}

/**
 * 根据工具名和参数预取操作对象详情。
 * 失败时返回 null，不影响确认流程。
 */
export async function fetchDetailPreview(
  toolName: string,
  args: unknown
): Promise<DetailPreview | null> {
  try {
    const input = args as Record<string, unknown>

    switch (toolName) {
      case "deleteRecord":
      case "updateRecord": {
        const result = await helpers.getRecord(input.recordId as string)
        if (!result.success) return null
        const data = result.data as Record<string, unknown>
        return {
          title: extractRecordTitle(data),
          type: "record",
          fields: Object.entries(data)
            .filter(([k]) => k !== "id" && k !== "tableId")
            .filter(([_, v]) => v != null && v !== "")
            .map(([key, value]) => ({
              label: key,
              value: formatFieldValue(value),
            })),
        }
      }

      case "importPaper": {
        const paperData = input.paperData as Record<string, unknown>
        const authors = input.authors as Array<Record<string, unknown>>
        return {
          title: `论文: ${(paperData.title_en as string) || (paperData.title_cn as string) || "未知"}`,
          type: "paper",
          fields: [
            { label: "英文标题", value: (paperData.title_en as string) || "-" },
            { label: "中文标题", value: (paperData.title_cn as string) || "-" },
            { label: "年份", value: paperData.publish_year ? String(paperData.publish_year) : "-" },
            { label: "期刊/会议", value: (paperData.venue_name as string) || "-" },
            { label: "DOI", value: (paperData.doi as string) || "-" },
          ].filter((f) => f.value !== "-"),
          summary: `共 ${authors.length} 位作者: ${authors.map((a) => a.name).join(", ")}`,
        }
      }

      case "generateDocument": {
        const result = await helpers.getTemplateDetail(input.templateId as string)
        if (!result.success) return null
        const formData = input.formData as Record<string, unknown>
        return {
          title: `模板: ${result.data.name}`,
          type: "template",
          fields: result.data.placeholders.map((p) => ({
            label: p.key,
            value: formatFieldValue(formData?.[p.key]) || "(空)",
          })),
        }
      }

      case "batchDeleteRecords":
      case "batchUpdateRecords": {
        const ids = (
          toolName === "batchDeleteRecords"
            ? input.recordIds
            : (input.updates as Array<{ recordId: string }>)?.map((u) => u.recordId)
        ) as string[]
        if (!ids || ids.length === 0) return null

        const previews = await Promise.all(
          ids.slice(0, 10).map(async (id) => {
            const result = await helpers.getRecord(id)
            return {
              id,
              label: result.success ? extractRecordTitle(result.data as Record<string, unknown>) : id,
            }
          })
        )
        return {
          title: `批量操作 ${ids.length} 条记录`,
          type: "record",
          recordCount: ids.length,
          items: previews,
        }
      }

      default:
        return null
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/lib/agent2/detail-preview.test.ts`
Expected: ALL PASS

- [ ] **Step 5: 提交**

```bash
git add src/lib/agent2/detail-preview.ts src/lib/agent2/detail-preview.test.ts
git commit -m "feat(agent2): 添加确认工具详情预取函数 fetchDetailPreview"
```

---

### Task 2: 更新 `wrapConfirm` 调用 `fetchDetailPreview`

**Files:**
- Modify: `src/lib/agent2/tools.ts:119-149` (wrapConfirm 函数)

- [ ] **Step 1: 在 `tools.ts` 中导入并调用 `fetchDetailPreview`**

在文件顶部添加导入：

```typescript
import { fetchDetailPreview } from "./detail-preview"
```

修改 `wrapConfirm` 函数（第 119-149 行），在 `return` 语句中添加 `detailPreview`：

```typescript
function wrapConfirm<T>(
  toolName: string,
  schema: z.ZodType<T>,
  description: string,
  executeFn: (args: T) => Promise<unknown>
) {
  return tool({
    description,
    inputSchema: schema,
    execute: async (args: T) => {
      const tokenResult = await createConfirmToken(
        conversationId,
        messageId,
        toolName,
        args
      );
      if (!tokenResult.success) {
        throw new Error(tokenResult.error.message);
      }

      return {
        _needsConfirm: true,
        token: tokenResult.data,
        toolName,
        toolInput: args,
        riskMessage: getRiskMessage(toolName),
        detailPreview: await fetchDetailPreview(toolName, args),
      };
    },
  });
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 3: 提交**

```bash
git add src/lib/agent2/tools.ts
git commit -m "feat(agent2): wrapConfirm 返回 detailPreview 字段"
```

---

### Task 3: 更新 System Prompt

**Files:**
- Modify: `src/lib/agent2/context-builder.ts:76-86` (工作原则部分)

- [ ] **Step 1: 在 system prompt 工作原则中添加第 7、8 条**

在 `context-builder.ts` 的 system prompt 模板中，第 82 行 `6. 论文导入流程...` 之后添加：

```
7. 确认流程 — 调用需要确认的工具（createRecord, updateRecord, deleteRecord, batchDeleteRecords, importPaper 等）时：
   - 工具会返回 { _needsConfirm: true }，表示操作已暂停等待用户确认
   - 收到此响应后，你必须停止生成，不要再次调用相同或类似的工具
   - 简短告知用户操作正在等待确认，用户可以在确认框中查看详情
   - 等待用户在界面中确认或拒绝后再继续
8. 删除操作流程 — 当用户要求删除记录时：
   - 如果用户提供了明确的记录 ID，直接调用 deleteRecord
   - 如果用户提供了模糊描述（如"删除论文 Attention Is All You Need"），先用 searchRecords 查询确认记录
   - deleteRecord 调用后系统会自动在确认框中展示记录详情
   - 不要反复重试调用，等待用户确认即可
```

- [ ] **Step 2: 验证 system prompt 缓存失效逻辑正常**

`invalidateSyspromptCache` 已在 `tool-executor.ts` 中被调用，无需修改。

- [ ] **Step 3: 提交**

```bash
git add src/lib/agent2/context-builder.ts
git commit -m "feat(agent2): system prompt 添加确认流程和删除操作指导"
```

---

### Task 4: 前端接口扩展 + 确认工具自动展开

**Files:**
- Modify: `src/components/agent2/message-parts.tsx:16-31, 248-286, 320-358`

- [ ] **Step 1: 扩展 `ConfirmToolOutput` 和 `ConfirmState` 接口**

替换 `message-parts.tsx` 第 16-31 行的接口定义：

```typescript
interface DetailPreview {
  title: string
  type: "record" | "paper" | "template" | "code" | "generic"
  fields?: Array<{ label: string; value: string }>
  summary?: string
  recordCount?: number
  items?: Array<{ id: string; label: string }>
}

interface ConfirmState {
  open: boolean
  toolName: string
  toolCallId: string
  toolInput: Record<string, unknown>
  riskMessage: string
  token: string
  detailPreview?: DetailPreview | null
}

interface ConfirmToolOutput {
  _needsConfirm: true
  riskMessage: string
  toolInput: Record<string, unknown>
  token: string
  detailPreview?: DetailPreview | null
}
```

- [ ] **Step 2: 在 dynamic-tool 的确认分支中传递 `detailPreview` 并加 `defaultOpen`**

修改第 256-286 行，`<Tool key={index}>` 改为 `<Tool key={index} defaultOpen>`，并在 `setConfirmState` 中传递 `detailPreview`：

```tsx
<Tool key={index} defaultOpen>
  <ToolHeader
    type="dynamic-tool"
    state="approval-requested"
    toolName={toolPart.toolName}
  />
  <ToolContent>
    <div className="space-y-3 p-3">
      <p className="text-sm text-muted-foreground">{confirmOutput.riskMessage}</p>
      <ToolInput input={confirmOutput.toolInput} />
      <button
        className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md"
        onClick={() => {
          setConfirmState({
            open: true,
            toolName: toolPart.toolName,
            toolCallId: toolPart.toolCallId,
            toolInput: confirmOutput.toolInput,
            riskMessage: confirmOutput.riskMessage,
            token: confirmOutput.token,
            detailPreview: confirmOutput.detailPreview,
          })
        }}
      >
        查看详情并确认
      </button>
    </div>
  </ToolContent>
</Tool>
```

- [ ] **Step 3: 在 tool-${name} 的确认分支中做同样修改**

修改第 329-358 行（static tool part 的确认分支），同样加 `defaultOpen` 和 `detailPreview`：

```tsx
<Tool key={index} defaultOpen>
  <ToolHeader
    type="dynamic-tool"
    state="approval-requested"
    toolName={toolName}
  />
  <ToolContent>
    <div className="space-y-3 p-3">
      <p className="text-sm text-muted-foreground">{confirmOutput.riskMessage}</p>
      <ToolInput input={confirmOutput.toolInput} />
      <button
        className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md"
        onClick={() => {
          setConfirmState({
            open: true,
            toolName,
            toolCallId: toolPart.toolCallId,
            toolInput: confirmOutput.toolInput,
            riskMessage: confirmOutput.riskMessage,
            token: confirmOutput.token,
            detailPreview: confirmOutput.detailPreview,
          })
        }}
      >
        查看详情并确认
      </button>
    </div>
  </ToolContent>
</Tool>
```

- [ ] **Step 4: 更新 `ToolConfirmDialog` 调用，传递 `detailPreview`**

修改第 423-441 行的 `<ToolConfirmDialog>` 组件调用，添加 `detailPreview` 属性：

```tsx
<ToolConfirmDialog
  open={confirmState.open}
  onOpenChange={(open) => setConfirmState(prev => ({ ...prev, open }))}
  toolName={confirmState.toolName}
  toolInput={confirmState.toolInput}
  riskMessage={confirmState.riskMessage}
  token={confirmState.token}
  detailPreview={confirmState.detailPreview}
  onConfirm={(result) => {
    setConfirmState(prev => ({ ...prev, open: false }))
    if (onToolConfirm && confirmState.toolCallId) {
      onToolConfirm({
        toolCallId: confirmState.toolCallId,
        toolName: confirmState.toolName,
        result,
      })
    }
  }}
  onReject={() => setConfirmState(prev => ({ ...prev, open: false }))}
/>
```

- [ ] **Step 5: 类型检查**

Run: `npx tsc --noEmit`
Expected: 可能有类型错误（ToolConfirmDialog 还没接收 detailPreview prop），将在 Task 5 修复

- [ ] **Step 6: 提交**

```bash
git add src/components/agent2/message-parts.tsx
git commit -m "feat(agent2): 前端接口扩展 + 确认工具自动展开"
```

---

### Task 5: 确认框渲染详情卡片

**Files:**
- Modify: `src/components/agent2/tool-confirm-dialog.tsx`

- [ ] **Step 1: 更新 props 接口并渲染详情卡片**

替换整个 `tool-confirm-dialog.tsx`：

```tsx
"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

interface DetailPreview {
  title: string
  type: "record" | "paper" | "template" | "code" | "generic"
  fields?: Array<{ label: string; value: string }>
  summary?: string
  recordCount?: number
  items?: Array<{ id: string; label: string }>
}

interface ToolConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  toolName: string
  toolInput: Record<string, unknown>
  riskMessage: string
  token: string
  detailPreview?: DetailPreview | null
  onConfirm: (result: unknown) => void
  onReject: () => void
}

function DetailPreviewCard({ preview }: { preview: DetailPreview }) {
  return (
    <div className="rounded-md border bg-muted/50 p-3 space-y-2">
      <p className="text-sm font-medium">{preview.title}</p>
      {preview.fields && preview.fields.length > 0 && (
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {preview.fields.map((field, i) => (
            <span key={i} className="contents">
              <span className="text-muted-foreground whitespace-nowrap">{field.label}:</span>
              <span className="break-all">{field.value}</span>
            </span>
          ))}
        </div>
      )}
      {preview.summary && (
        <p className="text-xs text-muted-foreground">{preview.summary}</p>
      )}
      {preview.items && preview.items.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-0.5">
          {preview.items.map((item) => (
            <li key={item.id} className="truncate">
              {item.label}
            </li>
          ))}
          {(preview.recordCount ?? 0) > preview.items.length && (
            <li className="italic">
              ...共 {preview.recordCount} 条
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

export function ToolConfirmDialog({
  open, onOpenChange, toolName, toolInput, riskMessage, token,
  detailPreview, onConfirm, onReject,
}: ToolConfirmDialogProps) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/agent2/confirm/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: true }),
      })
      const data = await res.json()
      if (data.success) onConfirm(data.data)
      else onReject()
    } catch {
      onReject()
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    await fetch(`/api/agent2/confirm/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: false }),
    })
    onReject()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-yellow-500" />
            确认执行操作
          </DialogTitle>
          <DialogDescription>{riskMessage}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-1">工具</p>
            <code className="text-sm bg-muted px-2 py-1 rounded">
              {toolName.startsWith("mcp__") ? (
                <>{toolName} <span className="text-xs text-muted-foreground">[外部工具]</span></>
              ) : (
                toolName
              )}
            </code>
          </div>
          {detailPreview ? (
            <div>
              <p className="text-sm font-medium mb-1">操作对象</p>
              <DetailPreviewCard preview={detailPreview} />
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium mb-1">参数</p>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40">
                {JSON.stringify(toolInput, null, 2)}
              </pre>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleReject} disabled={loading}>拒绝</Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? "执行中..." : "确认执行"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 3: 提交**

```bash
git add src/components/agent2/tool-confirm-dialog.tsx
git commit -m "feat(agent2): 确认框展示操作对象详情卡片"
```

---

### Task 6: 集成测试与验证

**Files:** 无新文件

- [ ] **Step 1: 运行全量测试确保无回归**

Run: `npx vitest run src/lib/agent2/ src/components/agent2/`
Expected: ALL PASS

- [ ] **Step 2: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 启动开发服务器手动验证**

Run: `npm run dev`

验证步骤：
1. 打开 agent2 对话页面
2. 输入"删除论文 Attention Is All You Need"
3. 确认 AI 不再反复重试调用 deleteRecord
4. 确认工具调用自动展开（不需要手动点开）
5. 点击"查看详情并确认"，确认对话框中显示论文详情（标题、作者等）
6. 点击"确认执行"或"拒绝"，确认操作正常完成

- [ ] **Step 4: 最终提交（如有修复）**

```bash
git add -u
git commit -m "fix(agent2): 集成测试修复"
```
