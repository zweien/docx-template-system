# 论文导入功能 — AI Agent2 集成设计

## 背景

Issue #20: 通过 AI Agent2 以自然语言对话形式将论文信息导入"论文表"和"作者表"，确认后写入数据。

已有基础设施：
- AI Agent2 聊天系统（流式响应、工具调用、确认机制）
- 论文表 + 作者表（RELATION_SUBTABLE 关联），结构定义在 `scripts/seed-papers.ts`
- 作者匹配基于 `name_norm` 标准化姓名

## 方案

为 Agent2 注册 3 个专用工具，复用现有聊天 + 确认 + 流式响应机制。

### 工具定义

#### 1. `parsePaperText`（只读，无需确认）

- **参数：** `{ text: string }`
- **功能：** AI 已在对话上下文中理解文本，此工具将解析结果规范化为论文字段结构，便于后续展示确认
- **返回：** 结构化论文元数据（title_en, title_cn, authors[], publish_year, venue_name, doi, paper_type 等）

#### 2. `fetchPaperByDOI`（只读，无需确认）

- **参数：** `{ doi: string }`
- **功能：** 调用 Crossref API 获取论文元数据
- **API：** `https://api.crossref.org/works/{doi}`（免费、无需 API key）
- **备选：** Semantic Scholar API `https://api.semanticscholar.org/graph/v1/paper/DOI:{doi}`
- **返回：** 结构化论文元数据 + 作者列表

#### 3. `importPaper`（需要 write 级别确认）

- **参数：** `{ paperData: PaperData, authors: AuthorInput[] }`
- **功能：**
  1. 按 `name_norm` 匹配已有作者，未找到则新建
  2. 创建论文记录
  3. 建立 RELATION_SUBTABLE 关联（含 author_order, is_first_author, is_corresponding_author）
  4. 刷新关联快照
- **返回：** 论文 ID + 各作者匹配/新建状态

### 数据流

#### 场景 1：文本粘贴导入

```
用户粘贴文本 → AI 调用 parsePaperText → 展示结构化结果
→ 用户逐条确认 → AI 调用 importPaper → 返回导入结果
```

#### 场景 2：DOI 查询导入

```
用户输入 DOI → AI 调用 fetchPaperByDOI → 展示元数据 + 作者匹配预览
→ 用户确认 → AI 调用 importPaper → 返回导入结果
```

#### 场景 3：多论文批量

```
用户粘贴多篇 → AI 逐篇 parse → 逐条展示确认 → 逐条 import → 汇总结果
```

### 作者匹配策略

1. 按 `name_norm` 模糊匹配已有作者
2. 匹配到 → 展示匹配结果
3. 未匹配 → 标记为"新建"，在确认阶段提示用户
4. 多个同名人冲突 → 展示候选列表让用户选择

### 文件结构

| 文件 | 用途 |
|------|------|
| `src/lib/agent2/paper-import-tools.ts` | 工具定义（parsePaperText, fetchPaperByDOI, importPaper） |
| `src/lib/agent2/paper-parser.ts` | 论文文本结构化解析 |
| `src/lib/agent2/doi-service.ts` | Crossref API 封装 |
| `src/lib/agent2/paper-import-executor.ts` | 导入执行（作者匹配、记录创建、关联建立） |
| `src/lib/agent2/tools.ts` | 修改：注册新工具 |

### 错误处理

- DOI 查不到 → 提示检查 DOI 或改用手动输入
- 必填字段缺失 → AI 追问用户补充
- 作者匹配冲突 → 展示候选列表
- API 调用失败 → 降级提示手动输入

### 实现优先级

**Phase 1（本次实现）：**
- 文本粘贴解析 + 导入
- DOI 查询导入

**Phase 2（后续迭代）：**
- 文件上传（PDF/Word）提取
- 批量 Excel 导入
