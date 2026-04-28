# Section AI 自动填充设计文档

## 背景

报告编辑器当前已在 prompt banner 中显示模板的写作指导（`[[PROMPT: ...]]` 解析结果）。用户希望在 banner 中增加一个按钮，能够根据该提示词要求，自动流式生成 section 内容并填充到编辑器中。

## 目标

1. 在编辑器 prompt banner 中增加"AI 生成"按钮
2. 点击后展开预览面板，实时流式显示 AI 生成的 Markdown 内容
3. 生成过程中用户可继续编辑主编辑器（并行编辑）
4. 生成完成后，用户可选择"续写"（追加）或"改写"（替换）应用到当前 section
5. 支持取消、重试、错误恢复

## 非目标

- 不替换现有的 Ask AI slash menu 功能（两者共存）
- 不自动保存预览内容（只有点击"续写/改写"后才写入 draft）
- 不要求用户填写所有 context_vars 后才可生成

## 架构

### 用户流程

```
用户点击 prompt banner 上的"AI 生成"按钮
        ↓
展开预览面板，显示"生成中..." + 取消按钮
        ↓
服务端流式返回 Markdown（不影响主编辑器，用户可继续编辑）
        ↓
预览面板实时显示生成的带格式文本
        ↓
生成完成后，面板显示两个操作按钮：
    ├─ "续写" → 将生成内容追加到 section 末尾
    └─ "改写" → 用生成内容替换整个 section
        ↓
内容被解析为 BlockNote blocks 后插入编辑器
        ↓
自动触发保存
```

### UI 设计

在现有 prompt banner 中增加操作区：

- **顶部行**：左侧保留"写作指导"标签 + mode badge，右侧新增"AI 生成"按钮
- **预览面板**：banner 下方展开，包含：
  - 标题"AI 生成预览" + 状态指示（spinner / 取消按钮）
  - Markdown 渲染区域（使用 `prose` 类）
  - 底部操作按钮："续写"、"改写"

样式：
- 预览面板使用 `bg-background` 与 banner 的 `bg-muted/50` 形成层次区分
- 所有 prompt 都显示 AI 生成按钮（不区分 mode）

### API 设计

**端点：** `POST /api/reports/drafts/[id]/sections/[sectionId]/generate`

**请求体：**
```json
{
  "prompt": "请重点阐述国内外研究现状和本项目的创新点",
  "target": "立项依据",
  "existingContent": "## 一、立项依据\n\n目前已有...",
  "context": {
    "APPLICANT_NAME": "张三"
  },
  "documentStructure": [
    { "id": "research_basis", "title": "一、立项依据" },
    { "id": "research_content", "title": "二、研究内容" }
  ]
}
```

**响应：** `text/event-stream`（SSE），流式返回 Markdown 文本

**服务端实现：**
```typescript
const result = streamText({
  model,
  system: SYSTEM_PROMPT,
  messages: [{ role: "user", content: buildUserMessage(body) }],
});
return result.toDataStreamResponse();
```

**System Prompt：**
```
你是一位专业的科研报告撰写助手。用户会给你：
1. 当前章节的写作要求（prompt）
2. 当前章节已有的内容（existingContent，可能为空）
3. 报告上下文变量（如申请人姓名）
4. 整篇报告的结构

你的任务是根据写作要求，生成高质量的 Markdown 格式内容。

规则：
- 如果已有内容为空或很少，直接根据要求生成完整内容
- 如果已有内容较多，分析现有内容是否满足要求，不满足则改写，满足则续写
- 使用标准 Markdown：# 表示标题，- 表示列表，**粗体** 等
- 只输出 Markdown 内容，不要输出任何解释或 meta 信息
- 内容要与上下文变量中的信息保持一致
```

### 数据流与状态管理

状态定义（页面组件本地）：
```typescript
interface GenerationState {
  isGenerating: boolean;
  showPreview: boolean;
  previewText: string;
  abortController: AbortController | null;
}
```

流式消费：
```typescript
const reader = response.body!.getReader();
const decoder = new TextDecoder();
let text = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  text += decoder.decode(value, { stream: true });
  setPreviewText(text);
}
```

取消机制：
```typescript
const cancelGeneration = () => {
  state.abortController?.abort();
  setState({ isGenerating: false });
};
```

应用逻辑：
- **续写**：`editor.insertBlocks(blocks, sectionEnd, "after")`
- **改写**：`editor.replaceBlocks(currentBlocks, blocks)`

section 切换时自动清理生成状态。

### 错误处理

| 场景 | 处理策略 |
|------|---------|
| 网络错误 / 服务端 500 | 预览面板显示"生成失败，请检查网络后重试"，保留"重新生成"按钮 |
| 用户点击取消 | abort 中断请求，保留已生成内容，按钮变为"继续生成" |
| section 切换 | 自动 abort，关闭预览面板 |
| AI 返回空内容 | 显示"未生成有效内容，请调整提示词后重试" |
| Markdown 解析失败 | fallback 为纯文本 paragraph block 插入 |
| 协作模式 | 正常插入，Yjs 自动同步 |
| 快速连续点击 | disabled 状态防止重复请求 |

## 接口变更

### 新增文件

- `src/app/api/reports/drafts/[id]/sections/[sectionId]/generate/route.ts` — 生成端点

### 修改文件

- `src/app/(reports)/reports/drafts/[id]/page.tsx` — 增加预览面板 UI 和生成状态管理
- `src/modules/reports/types/index.ts` — 如有需要增加类型定义

## 测试计划

- [ ] 空 section 点击"AI 生成"，验证流式显示和"改写"按钮可正常填充
- [ ] 有内容的 section 点击"AI 生成"，验证"续写"和"改写"都正常工作
- [ ] 生成过程中切换 section，验证自动取消
- [ ] 点击取消后重新生成，验证正常
- [ ] 网络断开时验证错误提示
- [ ] 协作模式下验证内容同步
