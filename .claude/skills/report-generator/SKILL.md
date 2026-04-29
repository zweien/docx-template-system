---
name: report-generator
description: >
  基于 report-engine 模板生成完整 Word 报告。当用户说"生成报告"、"写报告"、"帮我做报告"、
  "填充模板"、"generate report"、"fill template"、"create a report"、"write a report" 时使用此 skill。
  也适用于用户提到具体的报告类型如"项目申报书"、"调研报告"、"技术报告"、"分析报告"等场景。
  即使用户只是说"用这个模板生成报告"而没有更多信息，也应触发此 skill。
  当用户提供 .docx 模板并要求生成内容时，必须使用此 skill。
---

# Report Generator

基于 report-engine 模板生成完整 Word 报告的专用 skill。

## 核心概念

这个 skill 将"生成报告"拆分为 5 个阶段：

```
模板分析 → 用户访谈 → 数据采集 → 内容合成 → 渲染输出
```

**关键原则**：模板定义结构，数据驱动内容，LLM 负责合成。

## 前置条件

- 项目中已有 report-engine（`report-engine/src/report_engine/`）
- 模板 `.docx` 文件已准备好（可用 `report-template-builder` skill 生成）
- 已安装依赖：`pip install -e ".[dev]"`

## 工作流程

### Phase 1: 模板分析

读取用户提供的 `.docx` 模板，理解其结构：

```bash
# 用 python-docx 分析模板结构（含 JSON 输出）
python <skill-path>/scripts/analyze_template.py --template path/to/template.docx --json
```

输出包括：章节结构、占位符、样式信息，以及**模板中嵌入的 PROMPT 注释**。

**PROMPT 注释格式**：模板中可能包含 `[[PROMPT: target: prompt text | mode=xxx]]` 形式的写作指导，例如：

```
[[PROMPT: 立项依据: 请从国内外研究现状撰写，突出创新性和必要性 | mode=auto]]
[[PROMPT: 研究内容: 描述3-5项具体研究内容，每项配技术路线图 | mode=interactive]]
```

每个 prompt 包含：
- **target**：对应章节（section）或段落（paragraph）名称
- **prompt**：具体的写作要求
- **mode**：`auto`（自动生成）或 `interactive`（需确认）
- **level**：`section`（无 dot）或 `paragraph`（含 dot）

> **Prompt 优先原则**：如果模板自带 prompts，后续阶段优先遵循这些写作要求，而非通用默认规则。

如果用户没有提供模板，询问是否需要生成一个（使用 `report-template-builder` skill）。

### Phase 2: 用户访谈

**必须**在采集数据前与用户确认以下信息。

#### Prompt 优先策略

如果 Phase 1 发现模板自带 **PROMPT 注释**，按 mode 采取不同策略：

| mode | 策略 | 说明 |
|------|------|------|
| `auto` | **简化访谈** | Prompt 已明确写作要求，只需确认数据来源和特殊要求 |
| `interactive` | **重点确认** | Prompt 要求需经用户确认或补充，特别是关键参数 |

**示例**：模板中有 `[[PROMPT: 经费预算: 列出设备费、材料费、测试费，按50万总额分配 | mode=interactive]]`，则需要确认：
- "模板要求经费总额50万，是否调整？"
- "设备费和材料费的比例有要求吗？"

#### 访谈清单

1. **报告主题**：这份报告是关于什么的？
2. **目标读者**：谁会看这份报告？（领导、评审专家、客户等）
3. **数据来源**：内容从哪里获取？按需询问：
   - "有本地文件需要参考吗？"（PDF、Word、Markdown 等）
   - "需要搜索最新信息吗？"（Web 搜索）
   - "有知识库可以检索吗？"（RAG 系统）
   - "需要查询数据库或 API 吗？"
   - "需要生成图表或图片吗？"
4. **风格要求**：正式/非正式、字数要求、语言等
5. **特殊要求**：需要强调的内容、必须包含的数据等

将用户的回答整理为一份**内容规划文档**，列出每个 section 需要填充的内容和数据来源。**如果模板有 prompts，内容规划必须逐条对应 prompt 要求。**

### Phase 3: 数据采集

根据用户指定的数据来源，采集报告所需内容。

#### 3.1 本地文件

用户提供的 PDF、Word、Markdown 等文件：

```
# 用 Read 工具读取文件内容
# 对于 PDF，使用 pdf skill 提取文本
# 对于 Word，使用 docx skill 提取内容
```

#### 3.2 Web 搜索

需要最新信息时：

```
# 用 WebSearch 工具搜索
# 用 WebFetch 工具抓取特定网页
```

#### 3.3 知识库检索

如果用户有知识库系统（通过 MCP 或 API 提供）：

```
# 调用对应的 MCP 工具或 API
# 将检索结果保存为上下文
```

#### 3.4 数据库/API

需要查询结构化数据时：

```
# 用 Bash 工具执行数据库查询
# 用 WebFetch 调用 REST API
# 将结果格式化为表格或列表
```

#### 3.5 图片生成

根据需要生成图片：

```bash
# 图表：用 matplotlib 生成
python <skill-path>/scripts/generate_chart.py --type bar --data '{"labels":["A","B"],"values":[10,20]}' --output output/figures/chart.png

# Mermaid 图：用 mermaid-cli 生成
python <skill-path>/scripts/render_mermaid.py --input diagram.mmd --output output/figures/diagram.png

# 文生图：调用外部 API（需要用户配置）
# 使用 WebFetch 或 MCP 工具调用 DALL-E / Stable Diffusion
```

### Phase 4: 内容合成

这是核心步骤——将采集到的数据合成为 report-engine 的 payload JSON。

#### Prompt 驱动的内容合成

如果模板包含 PROMPT 注释，**每个 section 的内容必须严格遵循对应 prompt 的要求**。合成流程：

1. **匹配 prompt**：将模板解析出的 `prompts` 与 `sections` 逐一匹配（按 `target` 匹配 section 的 `title` 或 `id`）
2. **按 prompt 撰写**：根据每个 prompt 的 `text` 要求，精准生成该 section 的 blocks
3. **mode 处理**：
   - `auto`：直接按 prompt 生成，无需额外确认
   - `interactive`：生成后向用户展示要点，确认后再写入 blocks

**Prompt → Block 映射示例**：

```
Prompt: "列出3-5个具体研究目标，每个目标用编号" → blocks: [heading, numbered_list]
Prompt: "描述技术路线图，用流程图形式" → blocks: [heading, paragraph, image(mermaid)]
Prompt: "按50万总额分配经费，列出设备费/材料费/测试费" → blocks: [heading, table]
```

#### 合成规则

1. **context**：从用户访谈中提取项目基本信息
2. **sections**：每个 section 对应模板中的一个章节，包含 blocks 数组
3. **attachments**：附录内容（如有）
4. **style_map**：根据模板样式确定

**Block 选择指南**：

| 内容类型 | 推荐 block |
|----------|-----------|
| 标题 | `heading` |
| 段落文字 | `paragraph` 或 `rich_paragraph` |
| 要点列表 | `bullet_list` 或 `numbered_list` |
| 数据表格 | `table` |
| 学术三线表 | `three_line_table` |
| 引用 | `quote` |
| 注释说明 | `note` |
| 图片 | `image` 或 `two_images_row` |
| 代码 | `code_block` |
| 公式 | `formula` |
| 清单 | `checklist` |
| 分隔 | `horizontal_rule` 或 `page_break` |

**内容质量要求**：

- 每个 section 至少包含 1 个 heading 和 1 个 paragraph
- 数据必须有来源标注（用 `note` 或 `quote`）
- 表格必须有标题（`title` 字段）
- 图片必须有说明（`caption` 字段）

将合成结果保存为**简化内容描述**（不是完整 payload），然后用脚本自动构建：

```bash
# 1. Claude 生成简化内容描述（比完整 payload 简单得多）
# 保存到 output/<report_name>_content.json

# 2. 用 build_payload.py 自动构建合法 payload
python <skill-path>/scripts/build_payload.py \
  --content output/<report_name>_content.json \
  --output output/<report_name>.json \
  --template path/to/template.docx
```

**简化内容描述格式**（Claude 只需要生成这个）：

```json
{
  "title": "报告标题",
  "org": "单位名称",
  "leader": "负责人",
  "period": "2026年1月-12月",
  "sections": [
    {
      "name": "研究内容与技术路线",
      "blocks": [
        {"type": "heading", "text": "1.1 研究目标", "level": 2},
        {"type": "paragraph", "text": "本项目旨在..."},
        {"type": "table", "title": "表1", "headers": ["指标","目标"], "rows": [["准确率","95%"]]}
      ]
    }
  ],
  "attachments": [
    {
      "name": "经费预算",
      "blocks": [
        {"type": "appendix_table", "headers": ["科目","金额"], "rows": [["设备费","50万"]]}
      ]
    }
  ]
}
```

脚本自动完成：id/placeholder/flag_name 生成、style_map 合并、block 字段校验、template 契约检查。

**中文章节名自动映射**：`"研究内容"` → `RESEARCH_CONTENT_SUBDOC`，`"实施计划"` → `IMPLEMENTATION_PLAN_SUBDOC`，等等。

#### 自动化生成（可选）

如果模板包含 prompts 且你希望**自动调用 LLM 生成内容**，使用 `--auto-generate`：

```bash
# 1. 从模板提取 prompts 并生成简化内容描述
python <skill-path>/scripts/build_payload.py \
  --template path/to/template.docx \
  --output output/<report_name>.json \
  --auto-generate \
  --context '{"PROJECT_NAME": "XXX项目", "APPLICANT_ORG": "XX大学"}'
```

**`--auto-generate` 工作流程**：
1. 读取模板中的 `[[PROMPT: ...]]` 注释
2. 按 section 分组，提取每个 section 的写作要求
3. 调用 LLM API（需配置 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL` 环境变量）
4. 将 LLM 返回的 Markdown 自动转换为 blocks
5. 构建完整 payload 并输出

**环境变量配置**（从项目 `.env.local` 读取）：
```bash
export AI_BASE_URL="http://192.168.2.220:3000/v1"
export AI_API_KEY="sk-xxx"
export AI_MODEL="MiniMax-M2.5"
```

**仅提取 prompts 而不生成**（用于查看模板要求）：
```bash
python <skill-path>/scripts/build_payload.py \
  --template path/to/template.docx \
  --list-prompts
```

### Phase 5: 渲染输出

使用 report-engine 渲染最终报告：

```bash
# 1. 校验 payload
report-engine validate --payload output/<report_name>.json

# 2. 检查模板契约
report-engine check-template --template path/to/template.docx --payload output/<report_name>.json

# 3. 渲染输出
report-engine render --template path/to/template.docx --payload output/<report_name>.json --output output/<report_name>.docx
```

如果校验失败，根据错误信息修复 payload 后重试。

## 数据源适配模式

不同数据源的接入方式：

| 数据源 | 接入方式 | 示例 |
|--------|----------|------|
| 本地文件 | Read 工具 | `Read file.pdf` |
| Web 搜索 | WebSearch 工具 | `WebSearch "AI 教育政策 2025"` |
| 网页抓取 | WebFetch 工具 | `WebFetch https://example.com` |
| 知识库 | MCP 工具 | 调用用户配置的 RAG MCP |
| 数据库 | Bash + SQL | `sqlite3 data.db "SELECT ..."` |
| REST API | WebFetch | `WebFetch https://api.example.com/data` |
| LLM 生成 | 直接生成 | Claude 根据上下文撰写内容 |

## 图片生成工具

### matplotlib 图表

```bash
python <skill-path>/scripts/generate_chart.py \
  --type bar \
  --title "项目进度" \
  --data '{"labels":["Q1","Q2","Q3","Q4"],"values":[25,50,75,100]}' \
  --output output/figures/progress.png
```

支持类型：`bar`（柱状图）、`line`（折线图）、`pie`（饼图）、`scatter`（散点图）

### Mermaid 图

```bash
python <skill-path>/scripts/render_mermaid.py \
  --input diagram.mmd \
  --output output/figures/diagram.png
```

### 文生图

需要用户配置 API（如 DALL-E、Stable Diffusion）。通过 MCP 工具或 WebFetch 调用。

## 常见问题

### payload 校验失败

检查：
- 每个 section 是否有 `id`、`placeholder`、`flag_name`、`blocks`
- block 类型是否正确（如 `table` 必须有 `headers` 和 `rows`）
- `context` 中的 key 是否与模板占位符匹配

### 渲染后内容缺失

检查：
- 模板中是否有对应的 `{{p SECTION_SUBDOC }}` 占位符
- 模板中是否有对应的 `{%p if ENABLE_SECTION %}` 条件开关
- `style_map` 中的样式是否在模板中存在

### 图片不显示

检查：
- 图片文件路径是否正确（相对于工作目录）
- 图片文件是否存在
- `image` block 的 `path` 字段是否正确

## 参考文档

- `docs/report_engine_payload_spec.md` — payload 规范
- `docs/report_engine_template_spec.md` — 模板规范
- `data/examples/test_all_blocks.json` — 全量 block 示例
- `data/examples/grant_advanced_demo.json` — 实际 payload 示例
