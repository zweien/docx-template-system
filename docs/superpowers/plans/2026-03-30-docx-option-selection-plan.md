# DOCX 选项勾选生成 实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 docx 模板增加单选/多选选项组能力，在单份填写页完成选择，并在生成文档时仅替换选项前的勾选框符号而不重写正文文本和格式。

**Architecture:** 这次改造分三层推进。第一层扩展模板解析与占位符模型，让系统能从 docx 中识别 `{{选项:key|single}}` / `{{选项:key|multiple}}` 与后续 `□ 文本` 选项项；第二层扩展单份填写页的数据模型和表单组件，统一用弹层勾选交互承载单选与多选；第三层扩展 Python 生成服务，基于解析出的选项配置只替换勾选框字符。所有现有 `TEXT`、`TEXTAREA`、`TABLE` 能力必须保持兼容。

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Zod, Prisma 7, FastAPI, python-docx

---

## Chunk 1: 解析与占位符模型

### Task 1: 统一类型边界，给选项组留下稳定数据结构

**Files:**
- Modify: `src/types/placeholder.ts`
- Modify: `src/types/record.ts`
- Modify: `src/validators/placeholder.ts`
- Modify: `src/validators/draft.ts`
- Modify: `src/validators/record.ts`

- [ ] **Step 1: 先读现有字段边界，避免拍脑袋扩展**

Run:
```bash
sed -n '1,220p' "src/types/placeholder.ts"
sed -n '1,220p' "src/validators/placeholder.ts"
sed -n '1,220p' "src/validators/draft.ts"
sed -n '1,220p' "src/validators/record.ts"
```

Expected: 明确当前 `inputType`、`formData`、`columns` 的现状，只在现有模型上做最小扩展。

- [ ] **Step 2: 扩展占位符类型，不引入额外抽象层**

在 `src/types/placeholder.ts` 中新增最小必要类型：

```ts
export interface ChoiceOption {
  value: string;
  label: string;
}

export interface ChoicePlaceholderConfig {
  mode: "single" | "multiple";
  options: ChoiceOption[];
  marker: {
    template: string;
    checked: string;
    unchecked: string;
  };
}
```

并把 `PlaceholderItem.inputType` / `PlaceholderSnapshotItem.inputType` 扩展为：

```ts
"TEXT" | "TEXTAREA" | "TABLE" | "CHOICE_SINGLE" | "CHOICE_MULTI"
```

同时为 `PlaceholderItem` 增加可选字段：

```ts
choiceConfig?: ChoicePlaceholderConfig;
```

- [ ] **Step 3: 扩展记录与草稿表单值类型**

在 `src/types/record.ts`、`src/validators/draft.ts`、`src/validators/record.ts` 中把 `formData` 改成支持：

```ts
type FormDataValue =
  | string
  | string[]
  | Array<Record<string, string>>;
```

Zod 结构保持简单：

```ts
z.union([
  z.string(),
  z.array(z.string()),
  z.array(z.record(z.string(), z.string())),
])
```

- [ ] **Step 4: 扩展占位符验证器**

在 `src/validators/placeholder.ts` 中：

```ts
const choiceOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

const choiceConfigSchema = z.object({
  mode: z.enum(["single", "multiple"]),
  options: z.array(choiceOptionSchema).min(1),
  marker: z.object({
    template: z.string().min(1),
    checked: z.string().min(1),
    unchecked: z.string().min(1),
  }),
});
```

然后给 `placeholderItemSchema` / `updatePlaceholderSchema` 补上：

```ts
inputType: z.enum(["TEXT", "TEXTAREA", "TABLE", "CHOICE_SINGLE", "CHOICE_MULTI"])
choiceConfig: choiceConfigSchema.optional()
```

- [ ] **Step 5: 运行类型检查，确认没有遗漏的联合类型**

Run:
```bash
npx tsc --noEmit
```

Expected: 先出现与 `CHOICE_SINGLE` / `CHOICE_MULTI` 相关的编译错误清单；不要在这一阶段顺手修业务实现。

---

### Task 2: 扩展 docx 解析器，识别控制行与选项项

**Files:**
- Modify: `src/lib/docx-parser.ts`
- Create: `src/lib/docx-parser.test.ts`

- [ ] **Step 1: 先写失败测试，锁定第一版语法**

在 `src/lib/docx-parser.test.ts` 中新增最小覆盖：

```ts
it("应解析单选选项组", async () => {
  const result = await parseStructuredPlaceholders(docxPath);
  expect(result.choiceBlocks).toEqual([
    {
      key: "性别",
      mode: "single",
      options: [
        { value: "男", label: "男" },
        { value: "女", label: "女" },
      ],
    },
  ]);
});

it("应解析多组选项并保留普通占位符", async () => {
  expect(result.simplePlaceholders).toContain("姓名");
  expect(result.choiceBlocks.map((item) => item.key)).toEqual(["性别", "爱好"]);
});

it("控制行后没有选项时应抛错", async () => {
  await expect(parseStructuredPlaceholders(docxPath)).rejects.toThrow("选项组");
});
```

测试文件不要依赖真实业务模板。用 `JSZip` 在测试里写最小 `word/document.xml`，把段落文本拼成：

```xml
<w:p><w:r><w:t>{{选项:性别|single}}</w:t></w:r></w:p>
<w:p><w:r><w:t>□ 男</w:t></w:r></w:p>
<w:p><w:r><w:t>□ 女</w:t></w:r></w:p>
```

- [ ] **Step 2: 运行测试，确认当前实现确实不支持**

Run:
```bash
npm test -- --run "src/lib/docx-parser.test.ts"
```

Expected: FAIL，报 `choiceBlocks` 不存在或解析结果不包含选项组。

- [ ] **Step 3: 最小扩展 ParseResult，不重写现有表格块逻辑**

在 `src/lib/docx-parser.ts` 的 `ParseResult` 中新增：

```ts
choiceBlocks: Array<{
  key: string;
  mode: "single" | "multiple";
  options: Array<{
    value: string;
    label: string;
    paragraphIndex: number;
    markerText: string;
  }>;
}>;
```

只在现有 `extractTextFromXml` 之上新增“段落级扫描”，不要把整个解析器改成复杂 AST。

- [ ] **Step 4: 实现控制行 + 邻接选项项解析**

控制行正则保持第一版简单明确：

```ts
const choiceControlRegex =
  /\{\{\s*选项:([\w\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+)\|(single|multiple)\s*\}\}/;

const choiceOptionRegex = /^([□☐☑])\s*(.+)$/;
```

实现规则：
- 先把段落文本保留为数组，记录 `paragraphIndex`
- 命中控制行后，向后连续读取选项项
- 遇到空段落、新控制行、普通占位符段落、表格块标记时停止
- 至少需要 1 个选项
- `single` 映射到 `mode: "single"`，`multiple` 映射到 `mode: "multiple"`
- `value` 默认等于选项文字，第一版不做额外映射
- 控制行本身不进入 `simplePlaceholders`
- 选项项中的 `□ 文本` 不应被误识别为普通占位符

- [ ] **Step 5: 运行解析测试**

Run:
```bash
npm test -- --run "src/lib/docx-parser.test.ts"
```

Expected: PASS。

- [ ] **Step 6: 补一轮类型检查**

Run:
```bash
npx tsc --noEmit
```

Expected: 只剩下下游 service / UI 对新字段未适配的报错。

---

### Task 3: 让 placeholder service 能保存和返回选项占位符

**Files:**
- Modify: `src/lib/services/placeholder.service.ts`
- Modify: `src/lib/services/placeholder.service.test.ts`
- Modify: `src/lib/services/template.service.test.ts`

- [ ] **Step 1: 先写 service 失败测试**

在 `src/lib/services/placeholder.service.test.ts` 中新增：

```ts
it("parsePlaceholders 应创建 CHOICE_SINGLE 占位符并带 choiceConfig", async () => {
  parseStructuredPlaceholdersMock.mockResolvedValue({
    simplePlaceholders: ["姓名"],
    tableBlocks: [],
    choiceBlocks: [
      {
        key: "性别",
        mode: "single",
        options: [
          { value: "男", label: "男", paragraphIndex: 1, markerText: "□" },
          { value: "女", label: "女", paragraphIndex: 2, markerText: "□" },
        ],
      },
    ],
  });

  await service.parsePlaceholders("tpl-1");

  expect(dbMock.placeholder.createMany).toHaveBeenCalledWith({
    data: expect.arrayContaining([
      expect.objectContaining({
        key: "性别",
        inputType: "CHOICE_SINGLE",
        choiceConfig: {
          mode: "single",
          options: [
            { value: "男", label: "男" },
            { value: "女", label: "女" },
          ],
          marker: { template: "□", checked: "☑", unchecked: "☐" },
        },
      }),
    ]),
  });
});
```

在 `src/lib/services/template.service.test.ts` 中补一条读取断言，确保模板详情页能拿到 `choiceConfig`。

- [ ] **Step 2: 运行 service 测试，确认失败点准确**

Run:
```bash
npm test -- --run "src/lib/services/placeholder.service.test.ts" "src/lib/services/template.service.test.ts"
```

Expected: FAIL，原因为 `choiceBlocks` 未被处理或 `choiceConfig` 未返回。

- [ ] **Step 3: 在 service 里最小接入 choiceBlocks**

在 `src/lib/services/placeholder.service.ts` 中：

1. `mapPlaceholderItem` 读取 `choiceConfig`
2. `parsePlaceholders` 把 `choiceBlocks` 转成：

```ts
{
  key: block.key,
  label: block.key,
  inputType: block.mode === "single" ? "CHOICE_SINGLE" : "CHOICE_MULTI",
  required: false,
  sortOrder,
  templateId,
  choiceConfig: {
    mode: block.mode,
    options: block.options.map((option) => ({
      value: option.value,
      label: option.label,
    })),
    marker: {
      template: "□",
      checked: "☑",
      unchecked: "☐",
    },
  },
}
```

3. `validInputTypes` 扩展为包含新类型
4. `UpdatePlaceholderInput` 增加 `choiceConfig`
5. `updatePlaceholders` 在回写时保留 choiceConfig，和 `TABLE` 保留 columns 的策略一致

- [ ] **Step 4: 运行 service 测试**

Run:
```bash
npm test -- --run "src/lib/services/placeholder.service.test.ts" "src/lib/services/template.service.test.ts"
```

Expected: PASS。

- [ ] **Step 5: 跑一轮类型检查**

Run:
```bash
npx tsc --noEmit
```

Expected: 剩余错误应集中在表单组件和展示页。

---

## Chunk 2: 单份填写页与交互

### Task 4: 打通单份填写页的数据下发

**Files:**
- Modify: `src/app/(dashboard)/templates/[id]/fill/page.tsx`
- Modify: `src/components/forms/dynamic-form.tsx`

- [ ] **Step 1: 先读 Next.js 本地文档，避免写旧习惯代码**

Run:
```bash
sed -n '1,220p' "node_modules/next/dist/docs/01-app/index.md"
```

Expected: 确认当前项目 App Router 约束，后续只做兼容现有模式的最小变更。

- [ ] **Step 2: 先改页面层类型，让新占位符能传到客户端**

在 `src/app/(dashboard)/templates/[id]/fill/page.tsx` 中把 `inputType` 联合类型扩展为：

```ts
"TEXT" | "TEXTAREA" | "TABLE" | "CHOICE_SINGLE" | "CHOICE_MULTI"
```

并把 `choiceConfig` 一起传给 `DynamicForm`。

- [ ] **Step 3: 扩展 DynamicForm 的本地状态类型**

在 `src/components/forms/dynamic-form.tsx` 中：

```ts
type FormFieldValue = string | string[] | Record<string, string>[];
```

初始化规则：
- `TABLE` -> `[]`
- `CHOICE_MULTI` -> `[]`
- 其他 -> `string`

校验规则：
- `CHOICE_MULTI` 的 required：`Array.isArray(value) && value.length > 0`
- `CHOICE_SINGLE` 的 required：`typeof value === "string" && value.trim() !== ""`
- `TABLE` 维持当前跳过校验逻辑

- [ ] **Step 4: 跑类型检查，拿到真正需要补的 UI 缺口**

Run:
```bash
npx tsc --noEmit
```

Expected: 编译错误收敛到具体缺少的选项字段渲染分支。

---

### Task 5: 新增统一的选项勾选字段组件

**Files:**
- Create: `src/components/forms/choice-picker-field.tsx`
- Create: `src/components/forms/choice-picker-field.test.tsx`
- Modify: `src/components/forms/dynamic-form.tsx`

- [ ] **Step 1: 先写交互测试，不先做样式**

在 `src/components/forms/choice-picker-field.test.tsx` 中覆盖：

```tsx
it("单选模式应只保留一个选中值", async () => {
  render(
    <ChoicePickerField
      mode="single"
      options={[
        { value: "男", label: "男" },
        { value: "女", label: "女" },
      ]}
      value="男"
      onChange={onChange}
    />
  );
});

it("多选模式应返回字符串数组", async () => {
  render(
    <ChoicePickerField
      mode="multiple"
      options={[
        { value: "篮球", label: "篮球" },
        { value: "音乐", label: "音乐" },
      ]}
      value={["篮球"]}
      onChange={onChange}
    />
  );
});
```

组件测试重点是行为：
- 触发器显示当前值摘要
- 弹层打开后可勾选项
- 单选再次选择会覆盖旧值
- 多选支持勾选/取消

- [ ] **Step 2: 运行组件测试，确认失败**

Run:
```bash
npm test -- --run "src/components/forms/choice-picker-field.test.tsx"
```

Expected: FAIL，组件文件不存在。

- [ ] **Step 3: 实现最小可用组件**

`src/components/forms/choice-picker-field.tsx` 保持单一职责，只做选项选择，不处理保存/生成：

```tsx
interface ChoicePickerFieldProps {
  mode: "single" | "multiple";
  options: Array<{ value: string; label: string }>;
  value: string | string[];
  onChange: (nextValue: string | string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}
```

实现建议：
- 复用项目已有 `Popover` / `Button` / `Checkbox` / `Command` 风格组件；没有就用最小现成组件，不新造设计系统
- `single` 模式用点击项即提交
- `multiple` 模式用复选框
- 触发器文案：
  - 空值：`请选择`
  - 单选：显示 label
  - 多选：`已选择 N 项`

- [ ] **Step 4: 接入 DynamicForm**

在 `dynamic-form.tsx` 里新增渲染分支：

```tsx
if (ph.inputType === "CHOICE_SINGLE" || ph.inputType === "CHOICE_MULTI") {
  return (
    <ChoicePickerField
      mode={ph.inputType === "CHOICE_SINGLE" ? "single" : "multiple"}
      options={ph.choiceConfig?.options ?? []}
      value={formData[ph.key] as string | string[]}
      onChange={(value) => handleChoiceChange(ph.key, value)}
      disabled={saving || generating}
    />
  );
}
```

并新增：

```ts
const handleChoiceChange = (key: string, value: string | string[]) => {
  setFormData((prev) => ({ ...prev, [key]: value }));
};
```

- [ ] **Step 5: 运行组件测试和类型检查**

Run:
```bash
npm test -- --run "src/components/forms/choice-picker-field.test.tsx"
npx tsc --noEmit
```

Expected: PASS；如果还有错误，应来自记录详情页或生成链路对 `string[]` 的假设。

---

### Task 6: 修正详情展示和表单回显，避免 string[] 在现有页面炸掉

**Files:**
- Modify: `src/app/(dashboard)/records/[id]/page.tsx`
- Modify: `src/types/record.ts`

- [ ] **Step 1: 先写展示规则，不引入复杂 renderer**

在记录详情页把值显示规则收敛成：
- `TABLE`：沿用现有表格渲染
- `string[]`：用 `、` 拼接
- `string`：原样显示

最小判断：

```ts
const isChoiceArray = Array.isArray(value) && value.every((item) => typeof item === "string");
```

- [ ] **Step 2: 运行类型检查**

Run:
```bash
npx tsc --noEmit
```

Expected: Next/TS 层面应全部通过，剩余工作集中到 Python 生成服务。

---

## Chunk 3: 文档生成与回归验证

### Task 7: 扩展 Python 生成服务，只替换勾选框符号

**Files:**
- Modify: `python-service/main.py`
- Modify: `python-service/test_main.py`

- [ ] **Step 1: 先写 Python 失败测试，锁定“不改字只改框”**

在 `python-service/test_main.py` 中新增：

```py
def test_replace_choice_markers_single_keeps_text(self):
    doc = Document()
    doc.add_paragraph("{{选项:性别|single}}")
    doc.add_paragraph("□ 男")
    doc.add_paragraph("□ 女")

    process_choice_blocks(doc, {"性别": "女"})

    self.assertEqual(doc.paragraphs[0].text, "")
    self.assertEqual(doc.paragraphs[1].text, "☐ 男")
    self.assertEqual(doc.paragraphs[2].text, "☑ 女")

def test_replace_choice_markers_multiple_keeps_text(self):
    doc = Document()
    doc.add_paragraph("{{选项:爱好|multiple}}")
    doc.add_paragraph("□ 篮球")
    doc.add_paragraph("□ 音乐")

    process_choice_blocks(doc, {"爱好": ["音乐"]})

    self.assertEqual(doc.paragraphs[1].text, "☐ 篮球")
    self.assertEqual(doc.paragraphs[2].text, "☑ 音乐")
```

- [ ] **Step 2: 运行 Python 测试，确认失败**

Run:
```bash
cd "python-service" && python -m unittest test_main.py
```

Expected: FAIL，缺少 `process_choice_blocks` 或现有逻辑不会处理控制行。

- [ ] **Step 3: 在 Python 服务中最小补齐 choice 处理**

在 `python-service/main.py` 中新增：

```py
choice_control_pattern = re.compile(r"\{\{\s*选项:([\w" + CJK + r"]+)\|(single|multiple)\s*\}\}")
choice_option_pattern = re.compile(r"^([□☐☑])\s*(.+)$")
```

核心函数建议：

```py
def process_choice_blocks(doc: Document, form_data: dict[str, Any]) -> None:
    paragraphs = doc.paragraphs
    i = 0
    while i < len(paragraphs):
        control_match = choice_control_pattern.search(paragraphs[i].text)
        if not control_match:
            i += 1
            continue

        key = control_match.group(1)
        mode = control_match.group(2)
        raw_value = form_data.get(key)
        selected_values = (
            {str(raw_value)} if mode == "single" and raw_value not in (None, "")
            else {str(item) for item in raw_value} if isinstance(raw_value, list)
            else set()
        )

        paragraphs[i].text = ""
        i += 1
        while i < len(paragraphs):
            option_match = choice_option_pattern.match(paragraphs[i].text)
            if not option_match:
                break

            label = option_match.group(2)
            marker = "☑" if label in selected_values else "☐"
            paragraphs[i].text = f"{marker} {label}"
            i += 1
```

要求：
- 只改首个勾选符号和控制行，不改后面的文字
- `single` 只接受一个字符串值
- `multiple` 接受字符串数组
- 未选中统一输出 `☐`

- [ ] **Step 4: 把 choice 处理接入 `/generate` 主流程**

在现有 `simple_data` / `table_data` 拆分之外，再拆一层：

```py
choice_data: dict[str, str | list[str]] = {}
```

判断规则不要复杂：
- `list[str]` -> `choice_data`
- `list[dict]` -> `table_data`
- `str` -> `simple_data`

先处理普通文本替换，再处理 choice blocks，再处理表格块。

- [ ] **Step 5: 运行 Python 测试**

Run:
```bash
cd "python-service" && python -m unittest test_main.py
```

Expected: PASS。

---

### Task 8: 端到端回归验证

**Files:**
- Modify: 无

- [ ] **Step 1: 跑前端关键测试**

Run:
```bash
npm test -- --run \
  "src/lib/docx-parser.test.ts" \
  "src/lib/services/placeholder.service.test.ts" \
  "src/lib/services/template.service.test.ts" \
  "src/components/forms/choice-picker-field.test.tsx"
```

Expected: PASS。

- [ ] **Step 2: 跑 Python 关键测试**

Run:
```bash
cd "python-service" && python -m unittest test_main.py
```

Expected: PASS。

- [ ] **Step 3: 跑最终类型检查**

Run:
```bash
npx tsc --noEmit
```

Expected: PASS。

- [ ] **Step 4: 手工验证最短链路**

手工验证路径：
1. 上传一个包含 `{{选项:性别|single}}` 与 `□ 男 / □ 女` 的测试模板
2. 重新解析 placeholders
3. 打开 `/templates/[id]/fill`
4. 选择一个单选字段和一个多选字段
5. 生成文档后下载
6. 确认结果只变更为 `☑ / ☐`，文字和段落格式不变

Expected: 通过。

- [ ] **Step 5: 再决定是否补文档**

如果实现过程中新增了模板语法说明页面或上传校验提示，再补：
- `docs/development.md`
- `docs/troubleshooting.md`

否则不要为了“看起来完整”强行加文档，保持 YAGNI。
