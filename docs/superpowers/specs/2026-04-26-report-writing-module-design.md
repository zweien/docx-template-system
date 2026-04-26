# 报告撰写模块集成设计

## 背景

将 `/home/z/codebase/report-template` 项目集成为本项目的子模块。两个系统的模板用途不同：
- **填表模块**：用户上传带 `{{ placeholder }}` 的 .docx 模板，填写表单生成文档
- **报告撰写模块**：用户上传结构化 .docx 模板，用 BlockNote 编辑器分段撰写报告内容，支持 AI 辅助编辑

两套逻辑完全独立，但共享认证、用户、存储、LLM 等基础设施。

## 总体架构

```
docx-template-system
├── 填表模块 (dashboard)
│   ├── 模板管理、表单填写、文档生成、生成记录
│   └── python-service (:8065) - 占位符替换
├── 报告撰写模块 (reports)      ← 新增
│   ├── 报告模板管理、BlockNote 编辑器、AI 辅助编辑、草稿管理
│   └── report-engine (:8066)  ← 新增 Python 服务
└── 共享基础设施
    ├── 认证 (NextAuth)
    ├── 文件存储 (file.service.ts)
    ├── PostgreSQL + Prisma
    └── LLM 配置
```

## 关键决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| Python 渲染引擎 | 独立服务 (:8066) | 与现有 python-service 同模式，最少改动 |
| 数据存储 | PostgreSQL + Prisma | 统一管理，共享备份策略 |
| 前端集成 | 代码直接集成 | 两个项目都是 Next.js 16，统一构建部署 |
| AI 辅助 | 保留 BlockNote AI + 复用 LLM | 保留编辑器内 AI 原生体验 |
| 代码组织 | Route Group 隔离 | 模块边界清晰，报告代码高内聚 |
| 导航入口 | 顶级菜单项 | 与填表模块平行，独立入口 |

## 数据模型

在 Prisma schema 中新增以下模型（与填表系统的 Template/Draft 完全独立）：

```prisma
model ReportTemplate {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id])
  name              String
  originalFilename  String
  filePath          String
  parsedStructure   Json     // 解析出的 context_vars, sections, attachments_bundle 等
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  drafts            ReportDraft[]
}

model ReportDraft {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  templateId      String
  template        ReportTemplate @relation(fields: [templateId], references: [id])
  title           String   @default("未命名报告")
  context         Json     @default("{}")     // context 变量（项目名称、申请单位等）
  sections        Json     @default("{}")     // 各章节的 BlockNote blocks
  attachments     Json     @default("{}")     // 附件内容
  sectionEnabled  Json     @default("{}")     // 章节开关
  status          String   @default("draft")  // draft | exported
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

## 前端路由与目录结构

```
src/app/(reports)/
├── layout.tsx                    # 复用 SidebarLayout，标记报告模块激活状态
├── page.tsx                      # 重定向到 /reports/drafts
├── templates/
│   ├── page.tsx                  # 报告模板列表
│   └── upload/page.tsx           # 上传报告模板
├── drafts/
│   ├── page.tsx                  # 报告草稿列表
│   └── [id]/page.tsx             # 编辑器页面（核心）
└── api/reports/
    ├── templates/route.ts
    ├── drafts/
    │   ├── route.ts
    │   └── [id]/
    │       ├── route.ts
    │       └── export/route.ts
    ├── chat/route.ts             # BlockNote AI 代理（流式）
    └── upload/image/route.ts

src/modules/reports/
├── components/
│   ├── editor/
│   │   ├── ReportEditor.tsx      # BlockNote 编辑器包装
│   │   ├── OutlinePanel.tsx      # 大纲面板
│   │   ├── SectionSidebar.tsx    # 章节侧边栏（开关管理）
│   │   ├── MermaidBlock.tsx      # Mermaid 图表块
│   │   └── TableCaptionBlock.tsx # 表题块
│   ├── TemplateList.tsx
│   └── DraftList.tsx
├── stores/
│   └── report-draft-store.ts     # Zustand 状态管理
├── services/
│   ├── report-template.service.ts
│   └── report-draft.service.ts
├── types/
│   └── index.ts
├── converter/
│   └── blocknote-converter.ts    # BlockNote ↔ report-engine payload 转换
└── schema/
    └── blocknote-schema.ts       # BlockNote 自定义 schema
```

### 编辑器页面布局

```
┌──────────────────────────────────────────┐
│ Header: 返回 | 报告标题 | 保存 导出       │
├──────────┬─────────────────┬─────────────┤
│ 章节面板  │ BlockNote 编辑器│ 大纲面板    │
│          │                 │             │
│ ✓ 第一章 │                 │ 1.1 标题    │
│ ✓ 第二章 │                 │ 1.2 标题    │
│ ✗ 第三章 │                 │             │
│          │                 │             │
│ Context  │                 │             │
│ 项目名称 │                 │             │
│ 申请单位 │                 │             │
└──────────┴─────────────────┴─────────────┘
```

## API 设计

遵循现有三层模式（types → validators → services → route handlers）。

### 报告模板

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reports/templates` | 列出当前用户的报告模板 |
| POST | `/api/reports/templates` | 上传报告模板（.docx + 解析） |
| DELETE | `/api/reports/templates/:id` | 删除报告模板 |

### 报告草稿

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reports/drafts` | 列出当前用户的报告草稿 |
| POST | `/api/reports/drafts` | 创建草稿（关联模板） |
| GET | `/api/reports/drafts/:id` | 获取草稿详情 |
| PATCH | `/api/reports/drafts/:id` | 更新草稿（自动保存） |
| DELETE | `/api/reports/drafts/:id` | 删除草稿 |
| POST | `/api/reports/drafts/:id/export` | 导出 .docx |

### AI 聊天

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/reports/chat` | BlockNote AI 代理（流式响应） |

### 模板上传流程

```
用户上传 .docx → Node.js API 保存文件到 public/uploads/report-templates/
→ 调用 report-engine /parse-template 解析模板结构
→ 将 parsedStructure (sections, context_vars, attachments_bundle) 存入数据库
→ 返回模板信息给前端
```

### 导出流程

```
前端 PATCH 草稿 → 转换 BlockNote blocks 为 payload JSON
→ POST /export Node.js API 收到请求，组装完整 payload
→ Node.js 调用 report-engine /render，传入 payload + 模板文件路径
→ report-engine 渲染 .docx → 返回文件流给 Node.js
→ Node.js 转发给前端下载
```

## Python report-engine 服务

### 目录结构

```
report-engine/
├── main.py                  # FastAPI 入口（端口 8066）
├── requirements.txt         # docxtpl, python-docx, pydantic, fastapi, uvicorn
├── Dockerfile
└── src/report_engine/
    ├── blocks.py            # Block 渲染器（20种块类型）
    ├── renderer.py          # 主渲染编排
    ├── validator.py         # Payload 校验
    ├── schema.py            # Pydantic 数据模型
    ├── style_checker.py
    ├── template_checker.py
    ├── subdoc.py
    └── compat.py
```

### 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/parse-template` | 解析 .docx 模板，返回 sections/context_vars |
| POST | `/render` | 接收 payload + 模板路径，渲染 .docx 并返回 |

### 配置

- 环境变量 `REPORT_ENGINE_URL`（默认 `http://localhost:8066`）
- 不管理数据库，只负责渲染和解析

## 集成要点

1. **认证**：报告 API 复用 `auth()` session 检查，与填表模块共享 NextAuth
2. **文件存储**：复用 `file.service.ts`，报告模板存 `public/uploads/report-templates/`，图片存 `public/uploads/reports/images/`
3. **LLM**：报告 AI 聊天复用 `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `OPENAI_MODEL` 环境变量
4. **侧边栏**：在 `schema.ts` 中新增报告模块分组（撰写报告、报告模板、报告草稿）
5. **依赖**：需要添加 `@blocknote/*` 相关 npm 包（blocknote, @blocknote/shadcn, @blocknote/xl-ai, @ai-sdk/openai, ai）

## 迁移步骤概览

1. 在 Prisma schema 中添加 ReportTemplate 和 ReportDraft 模型
2. 创建 `report-engine/` Python 服务（从 report-template 复制核心引擎）
3. 创建 `src/modules/reports/` 目录，迁移前端组件、stores、转换器
4. 创建 `src/app/(reports)/` 路由组和 API 路由
5. 更新侧边栏导航配置
6. 安装 BlockNote 等 npm 依赖
7. 测试完整流程：模板上传 → 草稿创建 → 编辑器编辑 → AI 辅助 → 导出 .docx
