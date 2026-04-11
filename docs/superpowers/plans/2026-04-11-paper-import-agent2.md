# 论文导入 AI Agent2 工具 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AI Agent2 注册论文导入专用工具，支持文本粘贴解析和 DOI 查询两种方式导入论文到论文表和作者表。

**Architecture:** 新增 3 个 Agent2 工具（parsePaperText、fetchPaperByDOI、importPaper），通过现有的 `createTools()` 工厂函数注册，复用 Agent2 的聊天、确认、流式响应机制。DOI 查询调用 Crossref 公共 API。导入执行通过 `data-record.service` 和 `data-relation.service` 操作数据库。

**Tech Stack:** AI SDK `tool()`, Zod schemas, Crossref REST API, Prisma (data-record, data-relation services)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/agent2/doi-service.ts` | Crossref API 封装，DOI → 结构化论文元数据 |
| Create | `src/lib/agent2/paper-import-executor.ts` | 导入执行：作者匹配/创建、论文创建、关联建立 |
| Modify | `src/lib/agent2/tools.ts` | 注册 3 个新工具到 `createTools()` |
| Modify | `src/lib/agent2/tool-executor.ts` | 添加 `importPaper` 的实际执行逻辑 |
| Modify | `src/lib/agent2/confirm-store.ts` | 注册 `importPaper` 到 CONFIRM_REQUIRED_TOOLS 和 RISK_MESSAGES |
| Modify | `src/lib/agent2/context-builder.ts` | 系统提示中增加论文导入能力说明 |

---

### Task 1: 创建 DOI 服务 (`src/lib/agent2/doi-service.ts`)

**Files:**
- Create: `src/lib/agent2/doi-service.ts`

- [ ] **Step 1: 实现 DOI 查询服务**

```typescript
// src/lib/agent2/doi-service.ts

export interface DOIPaperResult {
  title: string;
  authors: Array<{ name: string; orcid?: string }>;
  year?: number;
  publishDate?: string;
  venueName?: string;
  doi: string;
  paperType?: "journal" | "conference";
  volume?: string;
  issue?: string;
  pages?: string;
  issn?: string;
  url?: string;
}

/**
 * 通过 DOI 从 Crossref API 获取论文元数据
 * API: https://api.crossref.org/works/{doi}
 */
export async function fetchPaperByDOI(
  doi: string
): Promise<{ success: true; data: DOIPaperResult } | { success: false; error: string }> {
  // 清理 DOI：移除 URL 前缀
  const cleanDOI = doi
    .replace(/^https?:\/\/doi\.org\//i, "")
    .replace(/^DOI:\s*/i, "")
    .trim();

  try {
    const response = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(cleanDOI)}`,
      {
        headers: { "User-Agent": "IDRL-DocxTemplateSystem/1.0 (mailto:admin@example.com)" },
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: `未找到 DOI "${cleanDOI}" 对应的论文，请检查 DOI 是否正确` };
      }
      return { success: false, error: `Crossref API 返回错误 (${response.status})` };
    }

    const json = (await response.json()) as { message: CrossrefWork };
    const item = json.message;

    // 提取作者
    const authors = (item.author ?? []).map((a) => ({
      name: [a.given, a.family].filter(Boolean).join(" "),
      orcid: a.ORCID?.replace("http://orcid.org/", ""),
    }));

    // 提取年份和日期
    const year = item.published?.["date-parts"]?.[0]?.[0]
      ?? item.created?.["date-parts"]?.[0]?.[0];
    const publishDate = item.published?.["date-parts"]?.[0]
      ? formatDateParts(item.published["date-parts"][0])
      : undefined;

    // 提取期刊/会议名
    const venueName = item["container-title"]?.[0] ?? item["event"]?.name ?? undefined;

    // 判断论文类型
    const paperType = inferPaperType(item.type);

    return {
      success: true,
      data: {
        title: item.title?.[0] ?? "",
        authors,
        year,
        publishDate,
        venueName,
        doi: cleanDOI,
        paperType,
        volume: item.volume ?? undefined,
        issue: item.issue ?? undefined,
        pages: item.page ?? undefined,
        issn: item.ISSN?.[0] ?? undefined,
        url: item.URL ?? `https://doi.org/${cleanDOI}`,
      },
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return { success: false, error: "Crossref API 请求超时，请稍后重试或手动输入论文信息" };
    }
    return { success: false, error: `DOI 查询失败: ${err instanceof Error ? err.message : "未知错误"}` };
  }
}

// ── Crossref API 类型 ──

interface CrossrefWork {
  title?: string[];
  author?: Array<{ given?: string; family?: string; ORCID?: string }>;
  published?: { "date-parts": number[][] };
  created?: { "date-parts": number[][] };
  "container-title"?: string[];
  event?: { name?: string };
  type?: string;
  volume?: string;
  issue?: string;
  page?: string;
  ISSN?: string[];
  URL?: string;
}

function formatDateParts(parts: number[]): string {
  const [y, m, d] = parts;
  if (d && m) return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (m) return `${y}-${String(m).padStart(2, "0")}`;
  return String(y);
}

function inferPaperType(type?: string): "journal" | "conference" | undefined {
  if (!type) return undefined;
  const lower = type.toLowerCase();
  if (lower.includes("proceedings") || lower.includes("conference")) return "conference";
  if (lower.includes("journal") || lower.includes("article")) return "journal";
  return undefined;
}
```

- [ ] **Step 2: 验证类型检查通过**

Run: `npx tsc --noEmit 2>&1 | grep doi-service`
Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/agent2/doi-service.ts
git commit -m "feat(agent2): 添加 DOI 查询服务（Crossref API）"
```

---

### Task 2: 创建论文导入执行器 (`src/lib/agent2/paper-import-executor.ts`)

**Files:**
- Create: `src/lib/agent2/paper-import-executor.ts`

- [ ] **Step 1: 实现论文导入执行器**

```typescript
// src/lib/agent2/paper-import-executor.ts
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { syncRelationSubtableValues } from "@/lib/services/data-relation.service";
import type { RelationSubtableValueItem } from "@/types/data-table";

// ── Types ──

export interface PaperInput {
  title_en: string;
  title_cn?: string;
  paper_type?: "journal" | "conference";
  group_name?: string;
  publish_year?: number;
  publish_date?: string;
  conf_start_date?: string;
  conf_end_date?: string;
  venue_name?: string;
  venue_name_cn?: string;
  conf_location?: string;
  doi?: string;
  index_type?: string;
  pub_status?: string;
  archive_status?: string;
  corr_authors?: string;
  inst_rank?: number;
  fund_no?: string;
  paper_url?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  impact_factor?: number;
  issn_isbn?: string;
  ccf_category?: string;
  cas_partition?: string;
  jcr_partition?: string;
  sci_partition?: string;
}

export interface AuthorInput {
  name: string;               // 原始姓名
  author_order: number;       // 作者顺序
  is_first_author: "Y" | "N";
  is_corresponding_author: "Y" | "N";
}

export interface ImportResult {
  paperId: string;
  authors: Array<{
    name: string;
    status: "matched" | "created";
    authorId: string;
  }>;
}

// ── Helpers ──

/** 标准化姓名：小写、去空格标点 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\-,.]+/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** 按名称查找"作者"表和"论文"表 */
async function findPaperAndAuthorTables(): Promise<{
  paperTableId: string;
  authorTableId: string;
  authorsFieldId: string;
} | null> {
  // 查找论文表（名称包含"论文"）
  const paperTable = await db.dataTable.findFirst({
    where: { name: { contains: "论文" } },
    include: { fields: true },
  });
  if (!paperTable) return null;

  // 在论文表中找到 authors 关系字段
  const authorsField = paperTable.fields.find(
    (f) => f.key === "authors" && f.type === "RELATION_SUBTABLE"
  );
  if (!authorsField || !authorsField.relationTo) return null;

  return {
    paperTableId: paperTable.id,
    authorTableId: authorsField.relationTo,
    authorsFieldId: authorsField.id,
  };
}

/** 在作者表中按标准化姓名匹配作者 */
async function matchOrCreateAuthor(
  authorTableId: string,
  name: string,
  userId: string
): Promise<{ id: string; status: "matched" | "created" }> {
  const norm = normalizeName(name);

  // 尝试匹配：按 name_norm 或 name_cn/name_en
  const existing = await db.dataRecord.findFirst({
    where: {
      tableId: authorTableId,
      OR: [
        { data: { path: ["name_norm"], string_contains: norm } },
        { data: { path: ["name_cn"], string_contains: norm } },
        { data: { path: ["name_en"], string_contains: norm } },
      ],
    },
  });

  if (existing) {
    return { id: existing.id, status: "matched" };
  }

  // 未匹配则新建
  const record = await db.dataRecord.create({
    data: {
      tableId: authorTableId,
      data: {
        name_cn: name,
        name_en: name,
        name_norm: norm,
      } as unknown as Prisma.InputJsonValue,
      createdById: userId,
    },
  });

  return { id: record.id, status: "created" };
}

// ── Main executor ──

export async function importPaper(
  paperData: PaperInput,
  authors: AuthorInput[],
  userId: string
): Promise<{ success: true; data: ImportResult } | { success: false; error: string }> {
  try {
    const tables = await findPaperAndAuthorTables();
    if (!tables) {
      return { success: false, error: "未找到论文表或作者表，请确保已运行 seed-papers 初始化" };
    }

    const { paperTableId, authorTableId, authorsFieldId } = tables;

    // 1. 匹配/创建所有作者
    const authorResults: ImportResult["authors"] = [];
    const authorIdMap = new Map<number, string>(); // author_order → recordId

    for (const author of authors) {
      const result = await matchOrCreateAuthor(authorTableId, author.name, userId);
      authorResults.push({
        name: author.name,
        status: result.status,
        authorId: result.id,
      });
      authorIdMap.set(author.author_order, result.id);
    }

    // 2. 创建论文记录
    const paperRecord = await db.dataRecord.create({
      data: {
        tableId: paperTableId,
        data: {
          paper_id: `paper-${Date.now()}`,
          title_en: paperData.title_en,
          title_cn: paperData.title_cn ?? "",
          paper_type: paperData.paper_type ?? "",
          group_name: paperData.group_name ?? "",
          publish_year: paperData.publish_year ?? null,
          publish_date: paperData.publish_date ?? "",
          conf_start_date: paperData.conf_start_date ?? "",
          conf_end_date: paperData.conf_end_date ?? "",
          venue_name: paperData.venue_name ?? "",
          venue_name_cn: paperData.venue_name_cn ?? "",
          conf_location: paperData.conf_location ?? "",
          doi: paperData.doi ?? "",
          index_type: paperData.index_type ?? "",
          pub_status: paperData.pub_status ?? "",
          archive_status: paperData.archive_status ?? "",
          corr_authors: paperData.corr_authors ?? "",
          inst_rank: paperData.inst_rank ?? null,
          fund_no: paperData.fund_no ?? "",
          paper_url: paperData.paper_url ?? "",
          volume: paperData.volume ?? "",
          issue: paperData.issue ?? "",
          pages: paperData.pages ?? "",
          impact_factor: paperData.impact_factor ?? null,
          issn_isbn: paperData.issn_isbn ?? "",
          ccf_category: paperData.ccf_category ?? "",
          cas_partition: paperData.cas_partition ?? "",
          jcr_partition: paperData.jcr_partition ?? "",
          sci_partition: paperData.sci_partition ?? "",
        } as unknown as Prisma.InputJsonValue,
        createdById: userId,
      },
    });

    // 3. 建立论文-作者关联（RELATION_SUBTABLE）
    if (authors.length > 0) {
      const relationItems: RelationSubtableValueItem[] = authors.map((author, idx) => ({
        targetRecordId: authorResults[idx].authorId,
        displayValue: author.name,
        attributes: {
          author_order: author.author_order,
          is_first_author: author.is_first_author,
          is_corresponding_author: author.is_corresponding_author,
        },
        sortOrder: author.author_order,
      }));

      // 使用事务执行关联同步
      await db.$transaction(async (tx) => {
        await syncRelationSubtableValues({
          tx,
          sourceRecordId: paperRecord.id,
          tableId: paperTableId,
          relationPayload: { authors: relationItems },
        });
      });
    }

    return {
      success: true,
      data: {
        paperId: paperRecord.id,
        authors: authorResults,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: `导入论文失败: ${err instanceof Error ? err.message : "未知错误"}`,
    };
  }
}
```

- [ ] **Step 2: 验证类型检查**

Run: `npx tsc --noEmit 2>&1 | grep paper-import-executor`
Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/agent2/paper-import-executor.ts
git commit -m "feat(agent2): 添加论文导入执行器（作者匹配+关联建立）"
```

---

### Task 3: 注册工具到 `createTools()` (`src/lib/agent2/tools.ts`)

**Files:**
- Modify: `src/lib/agent2/tools.ts`

- [ ] **Step 1: 在 tools.ts 顶部添加 import**

在文件顶部 `import * as helpers from "./tool-helpers";` 后添加：

```typescript
import { fetchPaperByDOI } from "./doi-service";
import type { PaperInput, AuthorInput } from "./paper-import-executor";
```

- [ ] **Step 2: 在 `createTools()` 返回对象中添加 3 个新工具**

在 `generateChart` 工具后面、`return` 对象闭合括号前添加：

```typescript
    // ── Paper import tools ──
    parsePaperText: tool({
      description:
        "将用户输入的论文文本解析为结构化的论文元数据。当用户粘贴论文信息（标题、作者、年份等）时使用此工具。返回解析后的字段供用户确认。",
      inputSchema: z.object({
        rawText: z.string().describe("用户粘贴的论文信息原始文本"),
      }),
      execute: async (args) => {
        // AI 本身已在上下文中理解文本，此工具返回结构化模板供 AI 填充
        return {
          message: "请根据以下原始文本提取结构化论文信息，确保字段准确。提取后展示给用户确认。",
          rawText: args.rawText,
          fields: [
            "title_en", "title_cn", "paper_type", "group_name",
            "publish_year", "publish_date", "venue_name", "venue_name_cn",
            "doi", "index_type", "volume", "issue", "pages",
            "ccf_category", "cas_partition", "corr_authors",
          ],
          authorFields: ["name", "author_order", "is_first_author", "is_corresponding_author"],
        };
      },
    }),

    fetchPaperByDOI: tool({
      description:
        "通过 DOI 从 Crossref 学术数据库获取论文元数据。当用户提供 DOI 编号时使用此工具自动获取论文信息。",
      inputSchema: z.object({
        doi: z.string().describe("论文 DOI 编号，如 10.1038/nature14539"),
      }),
      execute: async (args) => {
        const result = await fetchPaperByDOI(args.doi);
        if (!result.success) {
          return { error: result.error };
        }
        return {
          paper: result.data,
          message: "请将以上信息展示给用户确认，并根据需要补充 group_name、index_type 等本地字段。",
        };
      },
    }),

    importPaper: wrapConfirm(
      "importPaper",
      "write",
      z.object({
        paperData: z.object({
          title_en: z.string().describe("英文标题"),
          title_cn: z.string().optional().describe("中文标题"),
          paper_type: z.enum(["journal", "conference"]).optional().describe("论文类型"),
          group_name: z.string().optional().describe("组别"),
          publish_year: z.number().optional().describe("发表年份"),
          publish_date: z.string().optional().describe("发表日期"),
          conf_start_date: z.string().optional().describe("会议开始日期"),
          conf_end_date: z.string().optional().describe("会议结束日期"),
          venue_name: z.string().optional().describe("期刊/会议名"),
          venue_name_cn: z.string().optional().describe("期刊/会议中文名"),
          conf_location: z.string().optional().describe("会议地点"),
          doi: z.string().optional().describe("DOI"),
          index_type: z.string().optional().describe("收录类型"),
          pub_status: z.string().optional().describe("刊出状态"),
          archive_status: z.string().optional().describe("归档状态"),
          corr_authors: z.string().optional().describe("通讯作者"),
          inst_rank: z.number().optional().describe("机构排名"),
          fund_no: z.string().optional().describe("基金编号"),
          paper_url: z.string().optional().describe("论文链接"),
          volume: z.string().optional().describe("卷"),
          issue: z.string().optional().describe("期"),
          pages: z.string().optional().describe("页码"),
          impact_factor: z.number().optional().describe("影响因子"),
          issn_isbn: z.string().optional().describe("ISSN/ISBN"),
          ccf_category: z.string().optional().describe("CCF分类"),
          cas_partition: z.string().optional().describe("中科院分区"),
          jcr_partition: z.string().optional().describe("JCR分区"),
          sci_partition: z.string().optional().describe("SCI分区"),
        }).describe("论文元数据"),
        authors: z.array(
          z.object({
            name: z.string().describe("作者姓名"),
            author_order: z.number().describe("作者顺序"),
            is_first_author: z.enum(["Y", "N"]).describe("是否第一作者"),
            is_corresponding_author: z.enum(["Y", "N"]).describe("是否通讯作者"),
          })
        ).describe("作者列表"),
      }),
      "导入论文到论文表（需要确认）",
      async (args) => {
        return { message: "论文导入待确认", args };
      }
    ),
```

- [ ] **Step 3: 验证类型检查**

Run: `npx tsc --noEmit 2>&1 | grep "tools\.ts"`
Expected: no output (no errors)

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent2/tools.ts
git commit -m "feat(agent2): 注册论文导入工具（parsePaperText, fetchPaperByDOI, importPaper）"
```

---

### Task 4: 添加 `importPaper` 到 tool-executor 和 confirm-store

**Files:**
- Modify: `src/lib/agent2/tool-executor.ts`
- Modify: `src/lib/agent2/confirm-store.ts`

- [ ] **Step 1: 在 confirm-store.ts 的 CONFIRM_REQUIRED_TOOLS 中添加 `"importPaper"`**

在 `CONFIRM_REQUIRED_TOOLS` 集合中添加 `"importPaper"`：

```typescript
const CONFIRM_REQUIRED_TOOLS = new Set([
  "createRecord",
  "updateRecord",
  "deleteRecord",
  "generateDocument",
  "executeCode",
  "batchCreateRecords",
  "batchUpdateRecords",
  "batchDeleteRecords",
  "importPaper",
]);
```

在 `RISK_MESSAGES` 中添加：

```typescript
  importPaper: "此操作将导入论文并创建/匹配作者记录",
```

- [ ] **Step 2: 在 tool-executor.ts 中添加 importPaper 的 case**

在文件顶部添加 import：

```typescript
import { importPaper } from "./paper-import-executor";
```

在 `batchDeleteRecords` case 之后、`default` 之前添加：

```typescript
    case "importPaper": {
      const paperData = toolInput.paperData as Parameters<typeof importPaper>[0];
      const authors = toolInput.authors as Parameters<typeof importPaper>[1];
      const result = await importPaper(paperData, authors, userId);
      if (!result.success) {
        return { success: false, error: result.error };
      }
      invalidateSyspromptCache();
      return { success: true, data: result.data };
    }
```

- [ ] **Step 3: 验证类型检查**

Run: `npx tsc --noEmit 2>&1 | grep -E "(tool-executor|confirm-store)"`
Expected: no output (no errors)

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent2/tool-executor.ts src/lib/agent2/confirm-store.ts
git commit -m "feat(agent2): 添加 importPaper 到确认机制和执行器"
```

---

### Task 5: 更新系统提示 (`src/lib/agent2/context-builder.ts`)

**Files:**
- Modify: `src/lib/agent2/context-builder.ts`

- [ ] **Step 1: 在系统提示中添加论文导入能力说明**

在 `## 能力范围` 列表中添加：

```
	- 通过 DOI 查询并导入论文（fetchPaperByDOI）
	- 解析用户输入的论文文本并导入（parsePaperText）
	- 导入论文到论文表，自动匹配/创建作者（importPaper）
```

在 `## 工作原则` 中添加第 6 条：

```
	6. 论文导入流程 — 用户提到"导入论文"时：先用 parsePaperText 解析文本或 fetchPaperByDOI 获取 DOI 信息，展示结果让用户确认，再调用 importPaper 导入。逐条确认。
```

- [ ] **Step 2: 验证构建**

Run: `npx tsc --noEmit 2>&1 | grep context-builder`
Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/agent2/context-builder.ts
git commit -m "feat(agent2): 系统提示增加论文导入能力说明"
```

---

### Task 6: 集成测试（手动）

- [ ] **Step 1: 启动开发服务器**

Run: `npm run dev`

- [ ] **Step 2: 在 Agent2 聊天中测试 DOI 导入**

输入: "帮我导入 DOI 10.1038/nature14539"

验证：
- AI 调用 `fetchPaperByDOI` 返回论文元数据
- AI 展示解析结果（标题 "Deep learning"、3 位作者等）
- AI 展示作者匹配预览
- 用户点击确认后调用 `importPaper`
- 返回导入成功结果（论文 ID + 作者匹配状态）

- [ ] **Step 3: 在 Agent2 聊天中测试文本导入**

输入: "帮我导入这篇论文：Attention Is All You Need, 作者 Ashish Vaswani, Noam Shazeer, 2017, NeurIPS"

验证：
- AI 解析文本后展示结构化结果
- 用户确认后导入成功

- [ ] **Step 4: Commit (如有修复)**

```bash
git add -A
git commit -m "fix(agent2): 论文导入集成测试修复"
```

---

## Self-Review

1. **Spec coverage:**
   - parsePaperText 工具 → Task 3 ✓
   - fetchPaperByDOI 工具 → Task 1 + Task 3 ✓
   - importPaper 工具 → Task 2 + Task 3 ✓
   - 作者匹配逻辑 → Task 2 ✓
   - 确认机制 → Task 4 ✓
   - 系统提示更新 → Task 5 ✓
   - 集成测试 → Task 6 ✓

2. **Placeholder scan:** 无 TBD/TODO/模糊描述。所有代码块包含完整实现。

3. **Type consistency:**
   - `PaperInput` 和 `AuthorInput` 类型在 Task 2 定义，Task 3 引用一致
   - `importPaper()` 函数签名在 Task 2 定义，Task 4 tool-executor 调用参数匹配
   - `wrapConfirm` 的使用模式与现有工具一致
   - `syncRelationSubtableValues` 参数与 `data-relation.service.ts` 一致
