# AI Chat 能力升级设计规格

**日期**: 2026-03-30
**主题**: AI Chat 体验升级与会话持久化
**状态**: 待用户审阅

## 1. 背景与目标

当前 AI Chat 已具备最基础的自然语言问答和确认执行能力，但整体体验仍然过于简陋，主要问题如下：

- 前端未真正消费增量流，消息需等待完整返回后一次性展示
- 消息仅支持纯文本气泡，不支持完善的 Markdown 富文本呈现
- 输入区仅支持单行文本，不支持附件提交
- 会话不持久化，无法进行会话列表、标题、删除、重命名等管理
- 表详情页中的 AI 入口仍停留在嵌入式轻量抽屉形态，不适合作为长期主入口

本次升级目标：

- 提供接近 ChatGPT 的双栏聊天体验
- 支持稳定的流式输出和丰富 Markdown 展示
- 支持附件上传和基础文本抽取
- 支持完整的会话持久化与管理
- 保留现有业务型 AI 工具与确认执行链路
- 为后续 LangGraph agent orchestration 预留清晰扩展边界，但本轮不集成 LangGraph

## 2. 范围

### 2.1 本轮纳入范围

- 独立 AI Chat 页面升级为双栏布局
- 会话列表、新建、自动标题、重命名、删除、恢复历史
- 流式消息渲染
- 基于 `streamdown` 的 Markdown 增量展示
- 多行输入区与附件提交入口
- 附件基础文本抽取
- 当前表上下文注入
- 确认执行消息卡片化
- 表详情页 AI 按钮改为跳转新聊天页并带入 `tableId`

### 2.2 明确不做

- LangGraph runtime 集成
- 多 agent 编排 UI
- 向量检索式长期记忆
- 高级文档结构理解和复杂附件深度解析
- 多模态图像理解
- 跨会话共享知识库

## 3. 设计原则

### 3.1 KISS

- 保持聊天产品层、应用层、AI 运行层、持久化层职责清晰
- 首版附件仅做基础文本抽取，不引入复杂解析管线
- 首版上下文裁剪采用简单规则，不提前实现检索记忆系统

### 3.2 YAGNI

- 不为未来 LangGraph 预埋复杂运行时结构
- 仅保留必要的扩展字段和运行时适配边界
- 不维护两套等价聊天体验，仅保留一个主入口

### 3.3 DRY

- 独立页面与业务入口共用统一聊天壳与消息组件
- 统一流式事件协议，避免前后端各自维护不同消息语义
- 附件、消息、会话采用清晰实体关系，避免重复字段堆叠

### 3.4 SOLID

- 单一职责：会话管理、消息渲染、输入、附件、运行时适配分别拆分
- 开闭原则：运行层通过适配器切换，未来可从 AI SDK 替换为 LangGraph
- 依赖倒置：前端依赖统一事件协议，不直接依赖具体 LLM SDK 细节

## 4. 架构设计

整体分为四层：

### 4.1 聊天产品层

负责页面与交互体验：

- 双栏工作区布局
- 会话列表与管理
- 消息流展示
- 多行输入区
- 附件卡片与状态
- Markdown 渲染
- 错误与空态提示

该层使用 `streamdown` 实现增量 Markdown 渲染，消费统一流式事件协议。

### 4.2 聊天应用层

负责前端行为与业务语义编排：

- 会话创建、切换、删除、重命名
- 消息发送与流式消费
- 当前表上下文注入
- 附件上传、抽取、关联
- 确认执行流程接入消息流

该层是当前系统的核心适配层，后续切换 LangGraph 时尽量保持稳定。

### 4.3 AI 运行层

当前继续使用 `Vercel AI SDK + 现有 ai-agent service/tools`：

- 输入：用户消息、历史消息、附件摘要、表上下文
- 输出：标准化事件流

未来可通过 `AI Runtime Adapter` 替换为 LangGraph 实现，但不改变前端依赖的消息协议。

### 4.4 内容与持久化层

负责会话、消息、附件与抽取结果落库：

- 会话元数据
- 消息正文与状态
- 附件文件与元数据
- 抽取结果与摘要

文件本体首版可沿用现有上传存储方式。

## 5. 页面与交互设计

### 5.1 页面主形态

AI Chat 页面采用 ChatGPT 风格双栏布局：

- 左栏：会话列表
- 右栏：当前会话

桌面端固定双栏，移动端左栏折叠为抽屉或面板，但信息结构保持一致。

### 5.2 路由策略

- 主入口：`/ai-agent`
- 表详情页入口：跳转至 `/ai-agent?tableId=<id>`

不再保留表内抽屉作为长期主交互入口。

### 5.3 组件划分

建议组件结构如下：

```text
src/components/ai-chat/
├── ai-chat-shell.tsx
├── conversation-sidebar.tsx
├── conversation-header.tsx
├── message-thread.tsx
├── message-bubble.tsx
├── message-markdown.tsx
├── message-attachments.tsx
├── composer.tsx
├── attachment-picker.tsx
└── confirm-action-card.tsx
```

职责说明：

- `ai-chat-shell.tsx`: 双栏布局与页面级状态协调
- `conversation-sidebar.tsx`: 会话列表与管理操作
- `conversation-header.tsx`: 当前会话标题、表上下文、状态提示
- `message-thread.tsx`: 消息列表、滚动跟随、空态和加载态
- `message-bubble.tsx`: 单条消息容器与角色样式
- `message-markdown.tsx`: 基于 `streamdown` 的富文本渲染
- `message-attachments.tsx`: 消息上的附件显示与抽取状态
- `composer.tsx`: 多行输入、发送、附件入口
- `attachment-picker.tsx`: 文件选择与前端校验
- `confirm-action-card.tsx`: 消息流中的确认操作卡片

### 5.4 现有组件处理

- 现有 `AIChatClient` 不继续扩展为大而全组件，改造后仅保留为薄容器或移除
- 现有 `message-list.tsx` 与 `chat-input.tsx` 将被新组件替代
- 现有确认按钮改为消息流中的系统动作卡片

## 6. 数据模型设计

### 6.1 AiConversation

字段建议：

- `id`
- `title`
- `userId`
- `initialTableId` 可空
- `lastMessageAt`
- `createdAt`
- `updatedAt`
- `runtime` 默认 `ai-sdk`

### 6.2 AiMessage

字段建议：

- `id`
- `conversationId`
- `role`：`user | assistant | system`
- `status`：`pending | streaming | completed | failed`
- `content`
- `errorMessage` 可空
- `metadata` JSON 可空
- `createdAt`
- `updatedAt`

### 6.3 AiAttachment

字段建议：

- `id`
- `userId`
- `fileName`
- `mimeType`
- `size`
- `storagePath`
- `extractStatus`：`pending | processing | completed | failed`
- `extractedText` 可空
- `extractSummary` 可空
- `createdAt`

### 6.4 AiMessageAttachment

字段建议：

- `messageId`
- `attachmentId`

### 6.5 设计理由

- 会话、消息、附件解耦，职责清晰
- 附件与消息通过关联表建立关系，避免冗余字段
- `metadata` 和 `runtime` 为未来运行层演进提供最小扩展点

## 7. API 设计

建议新增或重构以下接口：

### 7.1 会话接口

- `POST /api/ai/conversations`
  - 创建会话，可接收 `initialTableId`

- `GET /api/ai/conversations`
  - 获取当前用户会话列表

- `PATCH /api/ai/conversations/[id]`
  - 重命名会话

- `DELETE /api/ai/conversations/[id]`
  - 删除会话

### 7.2 消息接口

- `GET /api/ai/conversations/[id]/messages`
  - 获取历史消息与附件

- `POST /api/ai/conversations/[id]/messages`
  - 发送消息并返回流式事件

### 7.3 附件接口

- `POST /api/ai/attachments`
  - 上传附件并返回附件元数据

### 7.4 兼容保留接口

- `POST /api/ai-agent/confirm`
  - 保留现有确认执行接口

## 8. 流式事件协议

首版建议统一使用明确的事件语义：

- `conversation-created`
- `message-created`
- `text-delta`
- `message-completed`
- `tool-call`
- `tool-result`
- `confirm-required`
- `attachment-status`
- `error`

协议目标：

- 前端可实时插入和更新 assistant 消息
- 可插入系统事件与业务动作卡片
- 保持与底层运行时实现解耦

## 9. 消息处理流程

### 9.1 发送消息

1. 前端提交文本和附件 ID
2. 服务端创建 `user` 消息
3. 关联 `AiMessageAttachment`
4. 如为首条消息，异步生成会话标题
5. 服务端创建状态为 `streaming` 的 `assistant` 消息
6. AI 运行层组装上下文并返回流式事件
7. 前端边消费边渲染，服务端在结束时回写最终内容与状态

### 9.2 上下文输入

本轮模型上下文由以下部分组成：

- 当前用户消息
- 最近若干轮历史消息
- 表结构与当前表上下文
- 已完成抽取的附件摘要

### 9.3 上下文裁剪

首版采用简单规则：

- 历史消息只保留最近 N 轮
- 附件仅使用 `extractSummary`
- 超长摘要按固定上限截断

不在本轮引入检索式长期记忆。

## 10. 附件处理设计

### 10.1 支持范围

首版支持基础文本抽取，目标文件类型：

- `txt`
- `md`
- `csv`
- `pdf`
- `docx`
- `xlsx`

### 10.2 处理流程

1. 前端上传文件
2. 服务端保存文件并写入 `AiAttachment`
3. 附件初始状态为 `pending`
4. 后台异步执行基础文本抽取
5. 写入 `extractedText` 与 `extractSummary`
6. 前端通过状态刷新或事件更新显示结果

### 10.3 消息发送时的规则

- 抽取完成：将 `extractSummary` 纳入上下文
- 抽取处理中：允许继续发送，但提示部分附件尚未完成解析
- 抽取失败：附件保留并展示失败状态，默认不纳入上下文

## 11. Markdown 渲染设计

### 11.1 渲染方案

前端使用 `streamdown` 负责增量 Markdown 渲染：

- 支持流式追加文本
- 支持代码块、列表、引用、表格等常见 Markdown 结构
- 保持接近 ChatGPT 的阅读体验

### 11.2 渲染约束

- Markdown 渲染与消息状态解耦
- 消息富文本渲染仅依赖当前累积文本
- 工具调用与确认动作不混入 Markdown 正文，单独使用系统块渲染

## 12. 确认执行设计

保留现有 `confirmToken` 模式，但交互方式改为消息流内嵌卡片：

1. assistant 返回 `confirm-required`
2. 前端在对应消息后渲染 `confirm-action-card`
3. 用户确认后调用确认接口
4. 成功或失败都追加可追溯的系统消息

优势：

- 历史记录完整可读
- 避免底部浮动操作与当前消息脱节

## 13. 错误处理

### 13.1 输入错误

- 空消息
- 文件格式不支持
- 附件数量、大小超限

策略：前端即时拦截，不进入会话流。

### 13.2 上传或抽取错误

策略：附件卡片就地报错，不阻塞整个会话。

### 13.3 AI 运行错误

策略：

- 当前 assistant 消息状态标记为 `failed`
- 保留用户消息
- 支持后续“重新生成”

### 13.4 持久化或网络错误

策略：

- 保留输入草稿
- 对消息显示待重试或失败状态
- 避免用户内容丢失

## 14. 分阶段交付

### 14.1 阶段一：聊天体验升级

- 双栏聊天页
- 会话列表与基础管理
- 流式消息展示
- `streamdown` Markdown 渲染
- 多行输入区
- 表详情页跳转并注入表上下文
- 确认执行流程整合进消息流

### 14.2 阶段二：附件与持久化增强

- 附件上传
- 基础文本抽取
- 附件状态显示
- 会话历史恢复
- 自动标题
- 重命名、删除会话完善
- 重试与失败恢复策略补齐

## 15. 测试策略

### 15.1 单元测试

- 标题生成策略
- 流式事件归并逻辑
- 消息状态机
- 上下文裁剪逻辑
- Markdown 消息组件基础渲染

### 15.2 集成测试

- 会话 CRUD 接口
- 流式消息接口协议
- 附件上传与抽取状态流转
- 确认执行闭环

### 15.3 UI 测试

- 双栏布局和移动端适配
- 流式自动滚动
- 会话切换与恢复
- 表详情页跳转上下文注入

## 16. 兼容性与扩展

### 16.1 与现有 ai-agent 兼容

- 复用现有工具能力与权限体系
- 逐步升级旧接口到新事件协议
- 不要求一次性重写全部 AI 服务实现

### 16.2 与未来 LangGraph 的扩展关系

本轮仅预留运行层适配边界：

- 前端依赖统一事件协议
- 服务层保留 `runtime` 和 `metadata` 最小扩展字段
- LangGraph 接入时可替换 AI 运行层，而不重写聊天产品层和持久化模型

## 17. 验收标准

1. AI Chat 页面升级为双栏会话布局
2. 用户可创建、切换、重命名、删除会话
3. assistant 消息支持真实流式输出
4. Markdown 在流式过程中可稳定渲染
5. 用户可上传附件并看到解析状态
6. 已完成解析的附件可纳入对话上下文
7. 历史会话可恢复并查看完整消息
8. 表详情页 AI 入口跳转独立聊天页并带入当前表上下文
9. 确认执行动作以消息卡片形式完整保留在会话历史中
10. 不引入 LangGraph 依赖的情况下完成首版升级
