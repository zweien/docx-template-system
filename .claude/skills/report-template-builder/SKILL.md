---
name: report-template-builder
description: >
  为 report-engine 项目创建或改造 .docx 模板，支持三种模式：从零生成、从文字描述生成、从现有 docx 改造。
  当用户说"制作模板"、"创建模板"、"新建模板"、"改造模板"、"修改模板"、"模板不对"、"模板报错"、
  "check-template 失败"、"样式缺失"、"placeholder 缺失"、"make template"、"create template"、
  "fix template"、"build a docx template for report engine" 时使用此 skill。
  也适用于用户提到"报告模板"、"申报书模板"、"Word 模板"、"docx 模板"、"根据描述生成模板"、
  "把现有模板改成引擎能用的"等场景。即使用户只是说"帮我做个模板"而没有更多信息，也应触发此 skill。
---

# Report Template Builder

为 report-engine 创建或改造 `.docx` 模板的专用 skill。支持三种输入模式。

## 核心概念

report-engine 的模板是 `.docx` 文件，包含三类占位元素：

| 类型 | 语法 | 用途 |
|------|------|------|
| 标量占位符 | `{{PROJECT_NAME}}` | 简单变量替换 |
| subdoc 插槽 | `{{p SECTION_SUBDOC }}` | 插入富内容块 |
| 条件开关 | `{%p if ENABLE_XXX %}...{%p endif %}` | 控制章节显示/隐藏 |

**关键原则**：模板决定"长什么样"，payload 决定"放什么内容"。

## 三种工作模式

### 模式 A：从零生成

用户明确告诉你要什么结构，直接用生成脚本。

### 模式 B：从文字描述生成

用户提供一段描述（如"项目申报书，包含研究内容、研究基础、实施计划，需要目录和附件"），用描述解析脚本自动生成。

### 模式 C：从现有 docx 改造

用户提供一个上级下发的或已有的 `.docx` 模板（仅有示例内容），用分析脚本提取结构并生成引擎兼容的模板和 payload。

## 工作流程

### Step 1: 确定输入模式

问用户：

1. "你有现成的 .docx 模板文件吗？" → 有：模式 C
2. "你能描述一下模板需要哪些章节吗？" → 能描述：模式 B
3. 都没有 → 模式 A，引导用户说出需求

### Step 2: 执行生成

#### 模式 A：从零生成

```bash
python <skill-path>/scripts/generate_template.py \
  --mode advanced \
  --output templates/my_template.docx \
  --sections "研究内容与技术路线,研究基础与条件保障,实施计划与进度安排" \
  --appendices \
  --toc
```

#### 模式 B：从文字描述生成

```bash
python <skill-path>/scripts/description_to_payload.py \
  --description "项目申报书，包含：一、研究内容，二、研究基础，三、实施计划，需要目录和附件" \
  --output-template templates/generated.docx \
  --output-payload data/examples/generated.json
```

也支持从文件读取描述：

```bash
python <skill-path>/scripts/description_to_payload.py \
  --file description.txt \
  --output-template templates/generated.docx \
  --output-payload data/examples/generated.json
```

#### 模式 C：从现有 docx 改造

```bash
python <skill-path>/scripts/analyze_docx.py \
  --input path/to/reference.docx \
  --output-template templates/generated.docx \
  --output-payload data/examples/generated.json
```

### Step 3: 验证模板

```bash
# 校验 payload
report-engine validate --payload data/examples/generated.json

# 检查模板与 payload 的契约
report-engine check-template --template templates/generated.docx --payload data/examples/generated.json

# 渲染测试
report-engine render --template templates/generated.docx --payload data/examples/generated.json --output output/test.docx
```

### Step 4: 手动完善

生成的模板和 payload 是骨架，用户需要：

1. 编辑 payload 填写实际内容（替换"（请填写）"占位符）
2. 在 Word 中调整模板的字体、间距、页边距等排版细节
3. 如有图片，在 payload 中添加 `image` 或 `two_images_row` block

## 描述解析规则（模式 B）

描述解析脚本支持以下格式：

| 格式 | 示例 |
|------|------|
| 中文数字序号 | 一、研究内容，二、研究基础 |
| 第X章/节 | 第一章 绪论，第二章 方法 |
| 数字序号 | 1. 研究目标，2. 技术路线 |
| 逗号/顿号分隔 | 研究内容，研究基础，实施计划 |
| 关键词检测 | "目录"→启用 TOC，"附件/附录"→启用附件区 |

## 样式要求

模板必须包含以下样式。生成脚本会自动创建，手动制作时需自行添加。

### 段落样式（12 种，9 种必检）

| 样式名 | 用途 | 是否必检 |
|--------|------|----------|
| `Heading 2` | 二级标题 | ✅ |
| `Heading 3` | 三级标题 | ✅ |
| `Body Text` | 正文 | ✅ |
| `TableCaption` | 表题 | ✅ |
| `FigureCaption` | 图题 | ✅ |
| `Legend` | 图例 | ✅ |
| `Figure Paragraph` | 图片段落 | ✅ |
| `List Bullet` | 无序列表 | ✅ |
| `List Number` | 有序列表 | ✅ |
| `Note` | 注释 | ❌ fallback 到 Body Text |
| `Quote` | 引用 | ❌ fallback 到 Body Text |
| `Checklist` | 清单 | ❌ fallback 到 List Bullet |
| `CodeBlock` | 代码块 | ❌ fallback 到 Body Text |

### 表格样式（2 种，1 种必检）

| 样式名 | 用途 | 是否必检 |
|--------|------|----------|
| `ResearchTable` | 研究表格 | ✅ |
| `AppendixTable` | 附录表格 | ❌ fallback 到 ResearchTable |

## 常见问题排查

### check-template 报 missing placeholders

模板中缺少 payload 要求的 subdoc 占位符。用生成脚本重新生成，或手动在模板中添加对应的 `{{p XXX_SUBDOC }}` 段落。

### check-template 报 missing flags

模板中缺少条件开关。确保每个 section 的 `flag_name` 都有对应的 `{%p if FLAG_NAME %}...{%p endif %}` 块。

### 渲染后样式不对

检查模板中的样式名是否与 `DEFAULT_STYLE_MAP` 一致。样式名区分大小写。

### 条件开关不生效

确保使用 `{%p if ... %}` 而不是 `{% if ... %}`。`p` 前缀是 docxtpl 的段落级 Jinja 语法。

### 从 docx 改造时章节识别不准确

analyze_docx.py 依赖标题样式（Heading 1/2）识别章节。如果原文档没有使用标准标题样式，需要手动调整生成的 payload 中的 sections。

## 模板内格式要求（可选增强）

用户可以在模板草稿中插入格式要求注释，由脚本自动解析并应用到样式，同时去除这些注释段落。

### 语法

在模板段落中写入：

```text
[[FORMAT: 目标样式: 属性=值, 属性=值, ...]]
```

或省略目标样式（自动推断）：

```text
[[FORMAT: 标题字体=黑体, 字号=三号]]
[[FORMAT: 正文字体=宋体, 字号=小四, 行距=1.5倍]]
[[FORMAT: 页面: 页边距上=2.54cm, 页边距左=3.17cm]]
```

### 自然语言描述（新）

也支持用自然语言整段描述格式要求，无需键值对：

```text
[[FORMAT: 书写正文内容时（除标题以外的内容），字体均为五号宋体；版式采用两端对齐，首行缩进"0.76厘米"，段前"0磅"，段后"0磅"，行距"最小值18磅"]]
```

脚本会自动从描述中提取格式信息。支持的自然语言模式：

| 模式 | 示例 | 提取结果 |
|------|------|---------|
| 字体+字号组合 | "字体均为五号宋体" | 字体=宋体, 字号=五号 |
| 版式/对齐 | "版式采用两端对齐" | 对齐=两端对齐 |
| 首行缩进 | "首行缩进0.76厘米" / "首行缩进2字符" | 首行缩进=0.76cm |
| 段前/段后 | "段前0磅" / "段后12磅" | 段前=0pt, 段后=12pt |
| 行距倍数 | "行距1.5倍" / "行距为2倍" | 行距=1.5 |
| 行距最小值 | "行距最小值18磅" | 行距=最小值18pt |
| 行距固定值 | "行距固定值20磅" | 行距=固定值20pt |
| 粗体/斜体 | "加粗" / "斜体" / "不加粗" | 粗体=true/false |
| 页边距 | "页边距上2.54cm" | 页边距上=2.54cm |

### 支持的属性

| 属性 | 示例值 | 说明 |
|------|--------|------|
| `字体` / `font` | 黑体、宋体、楷体 | 同时设置西文和东亚字体 |
| `字号` / `size` | 三号、小四、14 | 支持中文字号名或磅值 |
| `颜色` / `color` | #000000、红色、蓝色 | 支持颜色名或 #RRGGBB |
| `粗体` / `bold` | true / false | |
| `斜体` / `italic` | true / false | |
| `行距` / `lineSpacing` | 1.5、2.0 | 倍数行距 |
| `行距最小值` / `lineSpacingAtLeast` | 18pt | 最小值行距（Word AT_LEAST） |
| `行距固定值` / `lineSpacingExact` | 20pt | 固定值行距（Word EXACTLY） |
| `段前` / `spaceBefore` | 12pt | |
| `段后` / `spaceAfter` | 12pt | |
| `首行缩进` / `firstLineIndent` | 0.76cm、2字符 | 支持厘米或字符数（2字符≈0.74cm） |
| `对齐` / `align` | 左对齐、居中、右对齐、两端对齐 | |
| `页边距上/下/左/右` | 2.54cm | 仅当目标为"页面"时有效 |

### 目标样式推断

省略目标样式时，脚本从属性名自动推断：

| 属性名包含 | 目标样式 |
|-----------|---------|
| 标题 | Heading 2 |
| 正文 | Body Text |
| 表格/表头 | ResearchTable |
| 图片/图题 | Figure Paragraph |
| 代码 | CodeBlock |
| 引用 | Quote |
| 注释/注 | Note |
| 页面/页边距/纸张 | 页面 |

### 使用步骤

1. 在模板草稿中插入格式要求注释段落
2. 运行脚本处理：

```bash
python <skill-path>/scripts/apply_template_formats.py \
  --input templates/draft.docx \
  --output templates/clean.docx
```

3. 预览变更（不实际修改）：

```bash
python <skill-path>/scripts/apply_template_formats.py \
  --input templates/draft.docx \
  --output templates/clean.docx \
  --dry-run
```

### 完整示例

模板草稿 `draft.docx` 内容：

```text
[[FORMAT: Heading 2: 字体=黑体, 字号=三号, 段前=12pt, 段后=6pt]]
[[FORMAT: Body Text: 字体=宋体, 字号=小四, 行距=1.5倍]]
[[FORMAT: 页面: 页边距上=2.54cm, 页边距下=2.54cm, 页边距左=3.17cm, 页边距右=3.17cm]]
{{PROJECT_NAME}}
{%p if ENABLE_RESEARCH_CONTENT %}
{{p RESEARCH_CONTENT_SUBDOC }}
{%p endif %}
```

处理后 `clean.docx`：

- 格式要求段落已被去除
- Heading 2 样式已设置为黑体三号
- Body Text 样式已设置为宋体小四、1.5 倍行距
- 页面页边距已更新
- 只保留占位符和条件开关

## 参考文档

- `docs/report_engine_template_spec.md` — 完整模板规范
- `docs/report_engine_payload_spec.md` — payload 规范（了解 block 类型和字段）
- `scripts/build_test_template.py` — 项目中的模板生成脚本示例
- `data/examples/test_all_blocks.json` — 全量 block 类型的 payload 示例
