# 动态明细表生成 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持模板中的动态明细表——用户在 Word 模板中用 `{{#name}}...{{/name}}` 标记循环区域，系统根据填写的条目动态生成表格行，同时保留合并单元格格式。

**Architecture:** 三层改造——(1) docx-parser 新增循环块解析；(2) 前端新增明细表表单组件，formData 扩展为支持数组；(3) Python 服务新增行复制与合并单元格处理。所有现有简单占位符功能保持向后兼容。

**Tech Stack:** Next.js 16, Prisma 7, PostgreSQL, python-docx, lxml (XML deepcopy), FastAPI, shadcn/ui v4

---

### Task 1: 数据模型 + 类型 + Zod 验证

**Files:**
- Modify: `prisma/schema.prisma:72-75` (PlaceholderType enum)
- Modify: `prisma/schema.prisma:77-94` (Placeholder model)
- Modify: `src/types/placeholder.ts`
- Modify: `src/validators/placeholder.ts`
- Modify: `src/validators/draft.ts` (formData schema)
- Modify: `src/validators/record.ts` (formData schema)

- [ ] **Step 1: Update Prisma schema**

在 `prisma/schema.prisma` 中：

1. `PlaceholderType` 枚举添加 `TABLE`（第 72-75 行）：
```prisma
enum PlaceholderType {
  TEXT
  TEXTAREA
  TABLE
}
```

2. `Placeholder` 模型添加 `columns` 字段（在第 91 行 `enablePicker` 之后）：
```prisma
  columns   Json?
```

- [ ] **Step 2: Push schema and regenerate Prisma client**

Run:
```bash
npx prisma db push
npx prisma generate
```

Expected: 无错误，`PlaceholderType.TABLE` 和 `Placeholder.columns` 可用。

- [ ] **Step 3: Update TypeScript types**

修改 `src/types/placeholder.ts`，新增 `TableGridColumn` 接口，扩展 `PlaceholderItem`：

```typescript
export interface TableGridColumn {
  key: string;
  label: string;
}

export interface PlaceholderItem {
  id: string;
  key: string;
  label: string;
  inputType: string; // "TEXT" | "TEXTAREA" | "TABLE"
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  sourceTableId: string | null;
  sourceField: string | null;
  enablePicker: boolean;
  columns?: TableGridColumn[];  // 新增：仅 TABLE 类型
}
```

同步更新 `PlaceholderWithSource`（添加 `columns?: TableGridColumn[]`）和 `PlaceholderSnapshotItem`（`inputType` 联合类型添加 `"TABLE"`）。

- [ ] **Step 4: Update Zod validators**

修改 `src/validators/placeholder.ts`：

`placeholderItemSchema.inputType` 改为 `z.enum(["TEXT", "TEXTAREA", "TABLE"])`。

新增 `columns` 字段（可选）：
```typescript
columns: z.array(z.object({
  key: z.string(),
  label: z.string().min(1),
})).optional(),
```

- [ ] **Step 4b: Update draft and record Zod validators**

修改 `src/validators/draft.ts` 和 `src/validators/record.ts`：

将 `formData: z.record(z.string(), z.string())` 改为：
```typescript
formData: z.record(z.string(), z.union([
  z.string(),
  z.array(z.record(z.string(), z.string())),
])),
```

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`

Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/generated/ src/types/placeholder.ts src/validators/placeholder.ts
git commit -m "feat: add TABLE placeholder type and columns field to schema"
```

---

### Task 2: docx-parser 解析循环块

**Files:**
- Modify: `src/lib/docx-parser.ts`

- [ ] **Step 1: Add block pattern regex and ParseResult type**

在 `src/lib/docx-parser.ts` 顶部添加：

```typescript
export interface ParseResult {
  simplePlaceholders: string[];
  tableBlocks: Array<{ name: string; columns: string[] }>;
}
```

在 `matchPlaceholders` 函数之后添加两个新正则函数：

```typescript
const CJK_RANGE = "\\u4e00-\\u9fff\\u3400-\\u4dbf\\uf900-\\ufaff";

const blockStartRegex = new RegExp(`\\{\\{\\s*#([\\w${CJK_RANGE}]+)\\s*\\}\\}`, "g");
const blockEndRegex = new RegExp(`\\{\\{\\s*/([\\w${CJK_RANGE}]+)\\s*\\}\\}`, "g");
```

- [ ] **Step 2: Implement parseStructuredPlaceholders**

新增主解析函数：

```typescript
export async function parseStructuredPlaceholders(filePath: string): Promise<ParseResult> {
  const buffer = await readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = zip.file("word/document.xml");

  if (!documentXml) {
    throw new Error("无效的 docx 文件：缺少 word/document.xml");
  }

  const xmlContent = await documentXml.async("string");
  const text = extractTextFromXml(xmlContent);

  // Extract block markers
  const blockNames = new Set<string>();
  const startPositions: Array<{ name: string; index: number }> = [];
  const endPositions: Array<{ name: string; index: number }> = [];

  let m;
  const startRegex = new RegExp(blockStartRegex.source, "g");
  while ((m = startRegex.exec(text)) !== null) {
    blockNames.add(m[1]);
    startPositions.push({ name: m[1], index: m.index });
  }

  const endRegex = new RegExp(blockEndRegex.source, "g");
  while ((m = endRegex.exec(text)) !== null) {
    endPositions.push({ name: m[1], index: m.index });
  }

  // Validate pairing
  for (const name of blockNames) {
    const starts = startPositions.filter(p => p.name === name);
    const ends = endPositions.filter(p => p.name === name);
    if (starts.length !== 1 || ends.length !== 1) {
      throw new Error(`循环标记 {{#${name}}} 不成对（开始: ${starts.length}, 结束: ${ends.length}）`);
    }
    if (starts[0].index >= ends[0].index) {
      throw new Error(`循环标记 {{#${name}}} 的开始标记必须在结束标记之前`);
    }
  }

  // Extract placeholders inside blocks
  const tableBlocks: ParseResult["tableBlocks"] = [];
  for (const name of blockNames) {
    const start = startPositions.find(p => p.name === name)!;
    const end = endPositions.find(p => p.name === name)!;
    const blockText = text.slice(start.index, end.index + end[0].length);

    const innerPlaceholders = new Set<string>();
    const placeholderRegex = new RegExp(`\\{\\{\\s*([\\w${CJK_RANGE}]+)\\s*\\}\\}`, "g");
    let pm;
    while ((pm = placeholderRegex.exec(blockText)) !== null) {
      if (pm[1] === `#${name}` || pm[1] === `/${name}`) continue;
      innerPlaceholders.add(pm[1]);
    }

    tableBlocks.push({ name, columns: Array.from(innerPlaceholders) });
  }

  // Simple placeholders = all placeholders minus block markers and inner block keys
  const allPlaceholderRegex = new RegExp(`\\{\\{\\s*([\\w${CJK_RANGE}]+)\\s*\\}\\}`, "g");
  const blockKeys = new Set<string>();
  for (const name of blockNames) {
    blockKeys.add(`#${name}`);
    blockKeys.add(`/${name}`);
    const block = tableBlocks.find(b => b.name === name);
    if (block) block.columns.forEach(c => blockKeys.add(c));
  }

  const simplePlaceholders: string[] = [];
  while ((m = allPlaceholderRegex.exec(text)) !== null) {
    if (!blockKeys.has(m[1])) {
      if (!simplePlaceholders.includes(m[1])) {
        simplePlaceholders.push(m[1]);
      }
    }
  }

  return { simplePlaceholders, tableBlocks };
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`

Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add src/lib/docx-parser.ts
git commit -m "feat: parse {{#name}}...{{/name}} block markers in docx templates"
```

---

### Task 3: placeholder.service 适配结构化解析

**Files:**
- Modify: `src/lib/services/placeholder.service.ts:98-140` (parsePlaceholders)
- Modify: `src/lib/services/placeholder.service.ts:15-39` (mapPlaceholderItem)
- Modify: `src/lib/services/placeholder.service.ts:182` (updatePlaceholders inputType cast)

- [ ] **Step 1: Update mapPlaceholderItem to include columns**

修改 `src/lib/services/placeholder.service.ts` 的 `mapPlaceholderItem` 函数，增加 `columns` 参数映射：

在函数参数类型中增加 `columns: unknown`，在返回值中增加：
```typescript
columns: row.columns as TableGridColumn[] | undefined,
```

需要在文件顶部 import `TableGridColumn`：
```typescript
import type { PlaceholderItem, PlaceholderWithSource, TableGridColumn } from "@/types/placeholder";
```

- [ ] **Step 2: Rewrite parsePlaceholders to use parseStructuredPlaceholders**

将 `parsePlaceholders` 改为调用新的 `parseStructuredPlaceholders`：

```typescript
import { parseStructuredPlaceholders } from "@/lib/docx-parser";

export async function parsePlaceholders(
  templateId: string
): Promise<ServiceResult<PlaceholderItem[]>> {
  try {
    const template = await db.template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "模板不存在" },
      };
    }

    const result = await parseStructuredPlaceholders(template.filePath);

    await db.placeholder.deleteMany({ where: { templateId } });

    const createData: Array<{
      key: string;
      label: string;
      inputType: "TEXT" | "TEXTAREA" | "TABLE";
      required: boolean;
      sortOrder: number;
      templateId: string;
      columns?: unknown;
    }> = [];

    result.simplePlaceholders.forEach((key, index) => {
      createData.push({
        key,
        label: key,
        inputType: "TEXT",
        required: false,
        sortOrder: index,
        templateId,
      });
    });

    result.tableBlocks.forEach((block) => {
      createData.push({
        key: block.name,
        label: block.name,
        inputType: "TABLE",
        required: false,
        sortOrder: createData.length,
        templateId,
        columns: block.columns.map((col) => ({ key: col, label: col })),
      });
    });

    await db.placeholder.createMany({ data: createData });

    const placeholders = await db.placeholder.findMany({
      where: { templateId },
      orderBy: { sortOrder: "asc" },
    });

    return { success: true, data: placeholders.map(mapPlaceholderItem) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析占位符失败";
    return { success: false, error: { code: "PARSE_FAILED", message } };
  }
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`

Expected: 无错误。

- [ ] **Step 4: Fix updatePlaceholders inputType cast**

修改 `src/lib/services/placeholder.service.ts` 第 182 行，将：
```typescript
inputType: item.inputType as "TEXT" | "TEXTAREA",
```
改为：
```typescript
inputType: item.inputType as "TEXT" | "TEXTAREA" | "TABLE",
```

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/placeholder.service.ts
git commit -m "feat: placeholder service supports TABLE type with columns"
```

---

### Task 4: Python 服务 — 循环块处理

**Files:**
- Modify: `python-service/main.py`

- [ ] **Step 1: Update regex patterns to support CJK + block markers**

在 `python-service/main.py` 中添加 import 和新的正则：

```python
from copy import deepcopy
from typing import Any

CJK = r"\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff"

block_start_pattern = re.compile(r"\{\{\s*#([\w" + CJK + r"]+)\s*\}\}")
block_end_pattern = re.compile(r"\{\{\s*/([\w" + CJK + r"]+)\s*\}\}")
placeholder_pattern = re.compile(r"\{\{\s*([\w" + CJK + r"]+)\s*\}\}")
```

删除函数内旧的局部 `placeholder_pattern` 定义（第 36 行）。

- [ ] **Step 2: Update GenerateRequest model**

```python
class GenerateRequest(BaseModel):
    template_path: str
    output_filename: str
    form_data: dict[str, Any] = {}
```

- [ ] **Step 3: Update replace_placeholders_in_paragraph**

使用模块级 `placeholder_pattern`（删除函数内局部定义），并将 `form_data.get(key, match.group(0))` 改为 `form_data.get(key)` + 空值检查返回 `str(value)`。

- [ ] **Step 4: Implement process_table_block function**

```python
def process_table_block(table, block_name, rows_data, form_data):
    """Process {{#name}}...{{/name}} blocks in a table."""
    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    table_element = table._tbl

    # Find block marker rows
    start_row_idx = None
    end_row_idx = None
    for i, row in enumerate(table.rows):
        row_text = "".join(cell.text for cell in row.cells)
        if block_start_pattern.search(row_text):
            start_row_idx = i
        if block_end_pattern.search(row_text):
            end_row_idx = i
            break

    if start_row_idx is None or end_row_idx is None:
        return

    # Extract template rows (between markers, exclusive)
    tr_elements = table_element.findall(f".//{ns}tr")
    template_rows_xml = [deepcopy(tr_elements[i]) for i in range(start_row_idx + 1, end_row_idx)]

    # Remove marker rows and template rows (reverse order to preserve indices)
    for idx in reversed(range(start_row_idx, end_row_idx + 1)):
        parent = tr_elements[idx].getparent()
        if parent is not None:
            parent.remove(tr_elements[idx])

    if not rows_data:
        return

    # Find anchor for insertion (the row that was just before the removed block)
    tr_elements = table_element.findall(f".//{ns}tr")
    # Use the row at start_row_idx position (which is now the row after the removed block,
    # or the last row if block was at the end). New rows will be inserted before it.
    anchor_idx = min(start_row_idx, len(tr_elements)) if tr_elements else 0
    anchor = tr_elements[anchor_idx] if anchor_idx < len(tr_elements) else None

    # Clone and insert rows for each data item
    for item in rows_data:
        for row_xml in template_rows_xml:
            new_row = deepcopy(row_xml)
            _replace_in_row_xml(new_row, item)
            if anchor is not None:
                anchor.addnext(new_row)
            else:
                table_element.append(new_row)


def _replace_in_row_xml(row_xml, data):
    """Replace placeholders in a cloned row XML element."""
    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    for paragraph in row_xml.findall(f".//{ns}p"):
        full_text = "".join((t.text or "") for t in paragraph.findall(f".//{ns}t"))
        if "{{" not in full_text:
            continue

        new_text = placeholder_pattern.sub(
            lambda m: str(data.get(m.group(1), m.group(0))),
            full_text
        )
        if new_text == full_text:
            continue

        runs = paragraph.findall(f"{ns}r")
        if runs:
            t_elem = runs[0].find(f"{ns}t")
            if t_elem is not None:
                t_elem.text = new_text
            for run in runs[1:]:
                for t in run.findall(f"{ns}t"):
                    t.text = ""
```

- [ ] **Step 5: Update generate endpoint**

```python
@app.post("/generate")
async def generate_document(request: GenerateRequest):
    # ... existing file validation ...

    doc = Document(str(template_path))

    simple_data: dict[str, str] = {}
    table_data: dict[str, list[dict[str, str]]] = {}
    for key, value in request.form_data.items():
        if isinstance(value, list):
            table_data[key] = value
        else:
            simple_data[key] = str(value)

    for paragraph in doc.paragraphs:
        replace_placeholders_in_paragraph(paragraph, simple_data)

    for table in doc.tables:
        replace_placeholders_in_table(table, simple_data)
        for block_name, rows in table_data.items():
            process_table_block(table, block_name, rows, simple_data)

    # ... existing save logic ...
```

- [ ] **Step 6: Restart Python service**

```bash
cd python-service && .venv/bin/python main.py &
```

- [ ] **Step 7: Commit**

```bash
git add python-service/main.py
git commit -m "feat: support {{#name}}...{{/name}} block markers with row cloning"
```

---

### Task 5: 前端 — dynamic-table-field 组件

**Files:**
- Create: `src/components/forms/dynamic-table-field.tsx`

- [ ] **Step 1: Create DynamicTableField component**

参考 spec 中的设计，实现卡片式明细表编辑组件：

- 列标题行（只读）
- 数据行（Input 编辑，可删除）
- "添加一行" 按钮
- "选择数据" 按钮（数据选择器集成在此组件中）

组件 props: `tableKey`, `label`, `columns`, `value: TableRow[]`, `onChange`, `disabled`

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/forms/dynamic-table-field.tsx
git commit -m "feat: add DynamicTableField component for table placeholder editing"
```

---

### Task 6: 前端 — dynamic-form 集成明细表

**Files:**
- Modify: `src/components/forms/dynamic-form.tsx`

- [ ] **Step 1: Extend form types and state**

1. `Placeholder.inputType` 添加 `"TABLE"`
2. `Placeholder` 添加 `columns?: Array<{ key: string; label: string }>`
3. `formData` state 类型改为 `Record<string, string | TableRow[]>`
4. TABLE 类型初始化为空数组 `[]`
5. 添加 `handleTableChange` handler
6. `validate` 跳过 TABLE 类型

- [ ] **Step 2: Render TABLE placeholders using DynamicTableField**

在渲染循环中，检测 `ph.inputType === "TABLE"` 时渲染 `<DynamicTableField>`，否则渲染原有的 Input/Textarea。

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/components/forms/dynamic-form.tsx
git commit -m "feat: integrate DynamicTableField into dynamic form"
```

---

### Task 7: record + draft service formData 类型适配

**Files:**
- Modify: `src/lib/services/record.service.ts:106,192,306`
- Modify: `src/lib/services/draft.service.ts:40,104`

- [ ] **Step 1: Fix record.service.ts**

三处需要修改：
1. 第 106 行 `createRecord` 参数：`formData: Record<string, string>` → `formData: Record<string, unknown>`
2. 第 192 行：`as Record<string, string>` → `as Record<string, unknown>`
3. 第 306 行 `convertRecordToDraft`：`as Record<string, string>` → `as Record<string, unknown>`

- [ ] **Step 2: Fix draft.service.ts**

两处需要修改：
1. 第 40 行 `saveDraft` 参数：`formData: Record<string, string>` → `formData: Record<string, unknown>`
2. 第 104 行 `updateDraft` 参数：同上

- [ ] **Step 3: Type check and commit**

Run: `npx tsc --noEmit`

```bash
git add src/lib/services/record.service.ts src/lib/services/draft.service.ts
git commit -m "fix: extend formData type to support array values in record and draft services"
```

- [ ] **Step 2: Type check and commit**

Run: `npx tsc --noEmit`

```bash
git add src/lib/services/record.service.ts
git commit -m "fix: remove string assertion on record formData for table support"
```

---

### Task 8: 占位符配置页面 — TABLE 类型展示

**Files:**
- Modify: `src/components/templates/placeholder-config-table.tsx`

- [ ] **Step 1: Extend PlaceholderRow and render TABLE rows**

1. `PlaceholderRow.inputType` 添加 `"TABLE"`
2. `PlaceholderRow` 添加 `columns?: Array<{ key: string; label: string }>`
3. inputType Select 选项添加 TABLE
4. TABLE 行显示列定义预览（只读 key/label 列表）

- [ ] **Step 2: Type check and commit**

Run: `npx tsc --noEmit`

```bash
git add src/components/templates/placeholder-config-table.tsx
git commit -m "feat: show TABLE type placeholders in config table"
```

---

### Task 9: batch-generation + field-mapping + export 适配

**Files:**
- Modify: `src/lib/utils/field-mapping.ts`
- Modify: `src/lib/services/batch-generation.service.ts`
- Modify: `src/lib/services/export.service.ts`

- [ ] **Step 1: Fix field-mapping.ts buildFormData**

`buildFormData` 函数签名从返回 `Record<string, string>` 改为 `Record<string, unknown>`。循环块内列占位符在 field-mapping 中不参与映射（它们属于 TABLE 占位符的内部列）。

- [ ] **Step 2: Fix batch-generation.service.ts**

`batch-generation.service.ts` 中的 `buildFormData` 调用需要同步适配。明细表占位符（inputType === "TABLE"）在字段映射中跳过，数据通过固定值方式传递。

- [ ] **Step 3: Fix export.service.ts**

`export.service.ts` 中对 `formData[key]` 做 `String()` 的地方，数组值改为转为 JSON 字符串（`JSON.stringify(formData[key])`）或跳过。

- [ ] **Step 4: Type check and commit**

Run: `npx tsc --noEmit`

```bash
git add src/lib/utils/field-mapping.ts src/lib/services/batch-generation.service.ts src/lib/services/export.service.ts
git commit -m "fix: adapt batch generation and export for table placeholder data"
```

---

### Task 10: 端到端验证

**Files:** 无新代码，浏览器自动化测试。

- [ ] **Step 1: Create test template with merged cells and block markers**

用 python-docx 创建测试模板，包含：
- 简单占位符段落 `{{合同编号}}`
- 合并单元格表格 + `{{#研究计划}}...{{/研究计划}}` 标记
- 模板数据行含 `{{课题名称}}` 和 `{{负责人}}`

保存到 `public/uploads/templates/test-dynamic-table.docx`

- [ ] **Step 2: Verify parsing via browser**

1. 上传测试模板
2. 解析后确认 simplePlaceholders 和 tableBlocks 正确
3. 占位符配置页显示 TABLE 类型

- [ ] **Step 3: Verify form and generation**

1. 填写表单（合同编号 + 研究计划 2-3 行）
2. 生成文档
3. 确认生成结果：行数正确、合并单元格完整、占位符已替换

- [ ] **Step 4: Verify empty data**

1. 不填写明细表数据直接生成
2. 确认标记行和模板行被移除，无空行残留

- [ ] **Step 5: Commit test template**

```bash
git add public/uploads/templates/test-dynamic-table.docx
git commit -m "test: add dynamic table test template"
```

---

### Task 11: 草稿兼容验证

**Files:**
- Modify: `src/lib/services/draft.service.ts` (if needed)

- [ ] **Step 1: Check draft service**

检查 `src/lib/services/draft.service.ts` 中是否有 `Record<string, string>` 类型断言，如有则修复。

- [ ] **Step 2: Verify draft round-trip**

浏览器验证：填写含明细表的表单 → 保存草稿 → 重新打开 → 数据完整。

- [ ] **Step 3: Final commit if changes**

```bash
git add -u && git commit -m "fix: support table data in draft save/load"
```
