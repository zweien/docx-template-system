# 确认工具详情预取与 AI 流程指导

## 问题

1. **AI 不知道如何处理 `_needsConfirm`**：AI 调用 deleteRecord 等工具后，收到 `{ _needsConfirm: true }` 响应，但 system prompt 没有指导它停止并等待用户确认，导致它反复重试调用相同工具。
2. **确认框缺少有意义的详情**：用户在确认对话框中只看到 `{ recordId: "xxx" }` 这样的原始参数，看不到论文标题、作者等人类可读的信息。

## 设计方案

### 1. 后端：`wrapConfirm` 预取操作对象详情

**修改文件：** `src/lib/agent2/tools.ts`

在 `wrapConfirm` 的 `execute` 函数中，创建确认 token 之后，根据 `toolName` 调用对应的查询函数获取操作对象详情，将结果附加到返回的 `_needsConfirm` 响应中作为 `detailPreview` 字段。

#### 各工具的预取逻辑

| 工具 | 预取方式 | 预取内容 |
|------|----------|----------|
| `deleteRecord` | `helpers.getRecord(args.recordId)` | 记录的所有字段值 |
| `updateRecord` | `helpers.getRecord(args.recordId)` | 记录的当前字段值（对比用） |
| `createRecord` | 无预取 | 展示 `args.data`（即用户要创建的数据） |
| `batchDeleteRecords` | 逐个 `helpers.getRecord`（限制最多 10 条预览） | 各记录摘要 |
| `batchUpdateRecords` | 同上 | 各记录当前值 |
| `batchCreateRecords` | 无预取 | 展示前 5 条记录数据 |
| `importPaper` | 无预取（数据已在 args 中） | 格式化展示 `args.paperData` 和 `args.authors` |
| `generateDocument` | `helpers.getTemplateDetail(args.templateId)` | 模板名称和占位符列表 |
| `executeCode` | 无预取 | 展示代码内容 |
| MCP 工具 | 无预取 | 展示工具参数 |

`detailPreview` 的数据结构：

```typescript
interface DetailPreview {
  title: string           // 概要标题，如 "论文记录: Attention Is All You Need"
  type: "record" | "paper" | "template" | "code" | "generic"
  fields?: Array<{        // key-value 展示用
    label: string
    value: string
  }>
  summary?: string        // 额外描述
  recordCount?: number    // 批量操作时的记录数
  items?: Array<{         // 批量操作的简要列表
    id: string
    label: string
  }>
}
```

#### 实现方式

在 `wrapConfirm` 中新增异步函数 `fetchDetailPreview(toolName, args)`，返回 `DetailPreview | null`。如果预取失败（如记录不存在），返回 null，确认框仍然正常工作，只是不展示详情。

```typescript
async function fetchDetailPreview(
  toolName: string,
  args: unknown
): Promise<DetailPreview | null> {
  try {
    const input = args as Record<string, unknown>;
    switch (toolName) {
      case "deleteRecord":
      case "updateRecord": {
        const result = await helpers.getRecord(input.recordId as string);
        if (!result.success) return null;
        const data = result.data as Record<string, unknown>;
        // 从 data.values 中提取字段用于展示
        return {
          title: extractRecordTitle(data),
          type: "record",
          fields: Object.entries(data.values as Record<string, unknown> || {})
            .filter(([_, v]) => v != null && v !== "")
            .map(([key, value]) => ({
              label: key,
              value: formatFieldValue(value),
            })),
        };
      }
      case "importPaper": {
        const paperData = input.paperData as Record<string, unknown>;
        const authors = input.authors as Array<Record<string, unknown>>;
        return {
          title: `论文: ${paperData.title_en || paperData.title_cn || "未知"}`,
          type: "paper",
          fields: [
            { label: "英文标题", value: paperData.title_en as string },
            { label: "中文标题", value: (paperData.title_cn as string) || "-" },
            { label: "年份", value: String(paperData.publish_year || "-") },
            { label: "期刊/会议", value: (paperData.venue_name as string) || "-" },
            { label: "DOI", value: (paperData.doi as string) || "-" },
          ],
          summary: `共 ${authors.length} 位作者: ${authors.map(a => a.name).join(", ")}`,
        };
      }
      case "generateDocument": {
        const result = await helpers.getTemplateDetail(input.templateId as string);
        if (!result.success) return null;
        return {
          title: `模板: ${result.data.name}`,
          type: "template",
          fields: (result.data.placeholders || []).map((p: { name: string }) => ({
            label: p.name,
            value: (input.formData as Record<string, unknown>)?.[p.name] as string || "(空)",
          })),
        };
      }
      case "batchDeleteRecords":
      case "batchUpdateRecords": {
        const ids = (input.recordIds || input.updates?.map((u: { recordId: string }) => u.recordId)) as string[];
        const previews = await Promise.all(
          ids.slice(0, 10).map(async (id: string) => {
            const result = await helpers.getRecord(id);
            return {
              id,
              label: result.success ? extractRecordTitle(result.data) : id,
            };
          })
        );
        return {
          title: `批量操作 ${ids.length} 条记录`,
          type: "record",
          recordCount: ids.length,
          items: previews,
        };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
```

然后在 `wrapConfirm` 的返回值中包含 `detailPreview`：

```typescript
return {
  _needsConfirm: true,
  token: tokenResult.data,
  toolName,
  toolInput: args,
  riskMessage: getRiskMessage(toolName),
  detailPreview: await fetchDetailPreview(toolName, args),
};
```

### 2. 前端：确认框展示详情

**修改文件：**
- `src/components/agent2/tool-confirm-dialog.tsx`
- `src/components/agent2/message-parts.tsx`

#### 2.1 ConfirmToolOutput 接口扩展

在 `message-parts.tsx` 中扩展接口：

```typescript
interface DetailPreview {
  title: string
  type: "record" | "paper" | "template" | "code" | "generic"
  fields?: Array<{ label: string; value: string }>
  summary?: string
  recordCount?: number
  items?: Array<{ id: string; label: string }>
}

interface ConfirmToolOutput {
  _needsConfirm: true
  riskMessage: string
  toolInput: Record<string, unknown>
  token: string
  detailPreview?: DetailPreview | null
}
```

#### 2.2 ConfirmState 扩展

```typescript
interface ConfirmState {
  open: boolean
  toolName: string
  toolCallId: string
  toolInput: Record<string, unknown>
  riskMessage: string
  token: string
  detailPreview?: DetailPreview | null
}
```

#### 2.3 确认框 UI

当 `detailPreview` 存在时，在对话框中展示详情卡片：

- 标题行显示 `detailPreview.title`
- 字段以 key-value 表格展示（`detailPreview.fields`）
- 摘要文本显示在字段下方（`detailPreview.summary`）
- 批量操作时显示数量和简要列表

当 `detailPreview` 为 null 时，回退到当前的原始 JSON 展示。

### 3. System Prompt 更新

**修改文件：** `src/lib/agent2/context-builder.ts`

在 system prompt 的"工作原则"部分添加确认流程指导：

```
7. 确认流程 — 调用需要确认的工具（createRecord, updateRecord, deleteRecord, batchDeleteRecords, importPaper 等）时：
   - 工具会返回 { _needsConfirm: true }，表示操作已暂停等待用户确认
   - 收到此响应后，你必须停止生成，不要再次调用相同或类似的工具
   - 简短告知用户操作正在等待确认，用户可以在确认框中查看详情
   - 等待用户在界面中确认或拒绝后再继续
```

同时更新删除操作的具体指导：

```
8. 删除操作流程 — 当用户要求删除记录时：
   - 如果用户提供了明确的记录 ID，直接调用 deleteRecord
   - 如果用户提供了模糊描述（如"删除论文 Attention Is All You Need"），先用 searchRecords 查询确认记录
   - deleteRecord 调用后系统会自动在确认框中展示记录详情
   - 不要反复重试调用，等待用户确认即可
```

## 不在范围内

- 不修改确认 API 端点（`/api/agent2/confirm/[token]`）
- 不修改 `stopWhen` 逻辑（当前已正确检测 `_needsConfirm` 并停止）
- 不修改 MCP 工具的确认包装（MCP 工具参数本身已是详情）
- 不增加数据库字段（`detailPreview` 随工具返回值传递，不持久化）

## 关键文件

| 文件 | 改动 |
|------|------|
| `src/lib/agent2/tools.ts` | `wrapConfirm` 中添加 `fetchDetailPreview`，返回值增加 `detailPreview` |
| `src/lib/agent2/context-builder.ts` | system prompt 增加确认流程和删除操作指导 |
| `src/components/agent2/message-parts.tsx` | 扩展 `ConfirmToolOutput` 和 `ConfirmState` 接口 |
| `src/components/agent2/tool-confirm-dialog.tsx` | 接收 `detailPreview` 并渲染详情卡片 |
