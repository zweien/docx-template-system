# 动态明细表生成

## 背景

模板中存在需要根据数据条目动态生成行数的表格（如研究计划、经费明细）。当前系统仅支持表格内的简单占位符替换，无法根据数据动态增减行数。同时需要处理 Word 中常见的合并单元格场景。

## 模板语法

用 `{{#name}}` 和 `{{/name}}` 标记循环区域，标记可放在表格任意单元格中。

```
Word 模板：

| 研究计划  | 课题名称   | 负责人   |
|          | {{#研究计划}}          |     ← 标记行
|          | {{课题名称}} | {{负责人}} |    ← 模板数据行
|          | {{/研究计划}}          |     ← 标记行
```

生成后（3 条数据）：

```
| 研究计划  | 课题A      | 张三     |
|          | 课题B      | 李四     |
|          | 课题C      | 王五     |
```

### 规则

- `{{#name}}` 和 `{{/name}}` 之间的行为模板行，复制 N 份（N = 数据条目数）
- 标记行本身在生成时移除，不产生输出行
- 标记行可独占一行，也可与数据占位符在同一行
- 同一表格可以有多个独立的循环块
- 模板行可包含多行（一组一起复制）
- 名称支持中文和英文
- 不支持循环块嵌套
- `{{#name}}` 和 `{{/name}}` 必须成对出现，不匹配时报错提示

### 合并单元格

垂直合并单元格通过 XML 层面的 `w:vMerge` 实现。python-docx 的 `cell.text` 属性和 `deepcopy` 行 XML 可正确处理，但需要注意：

- `deepcopy` 行 XML 会完整复制 `w:vMerge` 属性（`restart` 或 `continue`），合并状态自动保留
- 模板行中 `vMerge="continue"` 的单元格在复制后仍为 `continue`，合并区域自动覆盖新行
- 无数据时：标记行和模板行全部移除，不保留任何行。合并单元格区域的 vMerge restart 行也一并移除（整个区域消失）
- 仅支持垂直合并（`vMerge`），不处理水平合并（`hMerge`/`gridSpan`）的行复制场景
- 首个实现阶段验证：生成后用 Word 打开确认合并区域完整、无格式损坏

### Word 跨 run 拆分

Word 可能将 `{{#研究计划}}` 拆分到多个 `<w:r>` 元素中（与现有 `{{key}}` 的问题相同）。python-docx 的 `paragraph.text` 和 `cell.text` 属性会自动合并同一段落内所有 run 的文本，因此对 `cell.text` 做正则匹配可正常工作。验证计划中包含此场景。

## 数据模型

### PlaceholderType 新增 TABLE

```prisma
enum PlaceholderType {
  TEXT
  TEXTAREA
  TABLE
}
```

### Placeholder 模型新增 columns 字段

```prisma
model Placeholder {
  // ... 现有字段
  inputType PlaceholderType @default(TEXT)
  columns   Json?            // TABLE 类型使用，存储列定义
}
```

columns JSON 结构：

```typescript
interface TableGridColumn {
  key: string;
  label: string;
}
```

**命名空间**：明细表内部的列占位符（如 `课题名称`、`负责人`）**不**作为独立 Placeholder 记录存储，仅存储在 TABLE 类型 Placeholder 的 `columns` JSON 中。这样避免与模板中其他位置的相同 key 产生 `@@unique([templateId, key])` 冲突。

### formData 结构

```typescript
type FormDataValue = string | Array<Record<string, string>>;

interface FormFormData {
  [key: string]: FormDataValue;
}
```

示例：

```typescript
{
  "合同编号": "HT-2026-001",          // 简单占位符
  "研究计划": [                        // 明细表
    { "课题名称": "课题A", "负责人": "张三" },
    { "课题名称": "课题B", "负责人": "李四" },
  ]
}
```

### 受影响的现有代码路径

formData 类型变更影响以下文件，均需适配：

| 文件 | 当前行为 | 需要的改动 |
|------|----------|------------|
| `src/lib/services/record.service.ts` | `as Record<string, string>` 断言 | 移除断言，使用 `FormFormData` 类型 |
| `src/lib/services/batch-generation.service.ts` | `buildFormData` 返回 `Record<string, string>` | 分离简单数据和明细表数据，分别传递 |
| `src/lib/services/export.service.ts` | `String(formData[key])` 导出 | 数组值转为 JSON 字符串或跳过 |
| `src/lib/utils/field-mapping.ts` | `buildFormData` 仅处理字符串 | 明细表占位符跳过或单独处理 |
| `src/components/forms/dynamic-form.tsx` | `Record<string, string>` state | 扩展为 `Record<string, FormDataValue>` |

草稿（Draft）的 `formData` 字段是 `Json` 类型，天然支持数组，无需 schema 变更。保存/加载时确保序列化/反序列化正确即可。

## 前端

### 解析器改造（docx-parser.ts）

返回结构化结果，区分简单占位符和循环块。循环块内部的列占位符仅出现在 `tableBlocks` 中，不出现在 `simplePlaceholders` 中。

```typescript
interface ParseResult {
  simplePlaceholders: string[];
  tableBlocks: Array<{ name: string; columns: string[] }>;
}
```

如果模板行中包含非循环块内的普通占位符（如 `{{日期}}`），该占位符仍归入 `simplePlaceholders`，生成时在各复制行中独立替换。

### 明细表表单组件（dynamic-table-field.tsx）

卡片式容器，包含：
- 列标题行（只读）
- 数据行（可编辑、可删除，最少 0 行）
- "添加一行"按钮
- "选择数据"按钮 → Dialog 从关联主数据表选择记录，追加到现有行

列的输入控件类型从关联主数据表的字段类型自动继承（DATE → 日期选择器、SELECT → 下拉框等）。

### 占位符配置页面

- 普通占位符：现有配置表格
- 明细表：折叠卡片，展开后显示列定义表格（key/label 可编辑）+ 关联主数据表选择

### 批量生成

明细表数据来源：
1. **映射主数据字段**：TABLE 类型占位符映射到数据表的 MULTISELECT 字段时，每个选项值生成一行（`{ [displayColumn]: optionValue }`）。映射到 RELATION 字段时，从关联记录取值生成多行
2. **固定值**：不映射任何数据表字段，所有文档共用相同的明细表数据（用户在配置时手动填写）

## Python 服务

### 正则更新

统一使用与前端 `docx-parser.ts` 完全相同的字符集：

```python
CJK = r"\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff"

block_start_pattern = re.compile(r"\{\{\s*#([\w" + CJK + r"]+)\s*\}\}")
block_end_pattern = re.compile(r"\{\{\s*/([\w" + CJK + r"]+)\s*\}\}")
placeholder_pattern = re.compile(r"\{\{\s*([\w" + CJK + r"]+)\s*\}\}")
```

同时修复现有 `placeholder_pattern`（第 36 行），使其也支持中文。

### API 改动

将 `form_data` 类型从 `dict[str, str]` 改为 `dict[str, Any]`，Python 端自行判断值的类型：

```python
class GenerateRequest(BaseModel):
    template_path: str
    output_filename: str
    form_data: dict[str, Any] = {}  # str | list[dict[str, str]]
```

生成时 Python 端遍历 `form_data`，值为 `list` 则查找对应 `{{#name}}` 循环块处理，值为 `str` 则按简单占位符替换。无需 Next.js 端拆分数据。

### process_table_block 函数

```python
def process_table_block(doc, table_index, block_name, rows_data, form_data):
```

处理流程：
1. 定位表格（`doc.tables[table_index]`）
2. 扫描表格所有行的 `cell.text`，找到 `{{#name}}` 和 `{{/name}}` 所在行索引
3. 提取标记行之间的模板行（lxml `deepcopy` XML 元素）
4. 移除标记行和模板行（从 XML 中删除对应 `<w:tr>` 元素）
5. 对每条数据：复制模板行 XML → 替换行内占位符 → 在锚点位置插入
6. rows_data 为空时不插入任何行

### 处理顺序

1. 处理简单占位符（段落 + 表格内非循环块单元格）
2. 处理循环块（按表格顺序，逐个处理 `{{#name}}` 块）

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/docx-parser.ts` | 修改 | 解析循环块，返回结构化结果 |
| `src/types/placeholder.ts` | 修改 | 新增 TABLE 类型、TableGridColumn、FormDataValue |
| `prisma/schema.prisma` | 修改 | PlaceholderType 增加 TABLE，Placeholder 增加 columns |
| `src/lib/services/placeholder.service.ts` | 修改 | 存储明细表占位符 |
| `src/lib/services/record.service.ts` | 修改 | formData 类型适配 |
| `src/lib/services/batch-generation.service.ts` | 修改 | 明细表数据传递 |
| `src/lib/services/export.service.ts` | 修改 | 数组值导出处理 |
| `src/lib/utils/field-mapping.ts` | 修改 | buildFormData 适配 |
| `src/components/forms/dynamic-form.tsx` | 修改 | 集成明细表组件，formData 类型扩展 |
| `src/components/forms/dynamic-table-field.tsx` | 新建 | 明细表表单组件 |
| `src/components/forms/data-picker-dialog.tsx` | 修改 | 支持选择多条记录 |
| `src/app/api/templates/[id]/placeholders/route.ts` | 修改 | 适配新解析结构 |
| `python-service/main.py` | 修改 | 循环块处理、合并单元格、正则更新 |
| `src/components/templates/placeholder-config-table.tsx` | 修改 | 明细表配置 UI |

## 验证

1. 创建含 `{{#研究计划}}...{{/研究计划}}` 和合并单元格的 .docx 模板
2. 上传后解析结果正确识别明细表和列字段
3. 配置页可编辑列定义、关联主数据表
4. 填写表单时可手动添加行、从主数据表选择
5. 生成文档：行数与数据条目一致、合并单元格完整、格式保留
6. 空数据时不插入任何行
7. 多个明细表独立工作
8. Word 将 `{{#name}}` 标记拆分到多个 run 时仍能正确解析
9. `{{#name}}` 和 `{{/name}}` 不成对时报错提示
10. 模板行中混合普通占位符（如 `{{日期}}`）和循环占位符时正确替换
11. 50+ 行数据时生成性能可接受
12. 草稿保存/加载明细表数据后数据完整
