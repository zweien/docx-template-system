# 模板管理重构设计

## 概述

重构模板管理模块，核心目标：

1. **合并上传与配置流程**：用分步向导替代分散的多页面跳转
2. **引入版本管理**：模板发布后产生版本快照，支持历史追溯
3. **暂存草稿**：未发布模板为草稿状态，只有发布后才能用于生成文档
4. **已发布模板可修改**：修改后重新发布产生新版本

## 数据模型

### Template 表调整

Template 从"同时承载编辑态和发布态"改为仅承载编辑态。

**保留字段**：`id`, `name`, `description`, `originalFileName`, `fileSize`, `status`, `createdById`, `createdAt`, `updatedAt`

**新增字段**：
- `currentVersionId` (`String?`)：指向当前生效的 TemplateVersion

**移除字段**：
- `filePath` → 移到 TemplateVersion
- `fileName` → 移到 TemplateVersion
- `dataTableId` → 移到 TemplateVersion
- `fieldMapping` → 移到 TemplateVersion

Template 新增的 filePath 字段仅存储编辑中的文件。

**status 枚举调整**：

```
现有：DRAFT → READY → ARCHIVED
改为：DRAFT → PUBLISHED → ARCHIVED

DRAFT     = 未发布（从未发布，或发布后新建了草稿）
PUBLISHED = 已发布（有至少一个版本，currentVersionId 不为空）
ARCHIVED  = 已归档
```

**Template 模型**：

```prisma
model Template {
  id                String            @id @default(cuid())
  name              String
  description       String?
  originalFileName  String            @default("")
  fileSize          Int               @default(0)
  filePath          String?           // 编辑中的文件路径
  status            TemplateStatus    @default(DRAFT)
  currentVersionId  String?
  currentVersion    TemplateVersion?  @relation("CurrentVersion", fields: [currentVersionId], references: [id])
  createdById       String
  createdBy         User              @relation(fields: [createdById], references: [id])
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  versions          TemplateVersion[]
  placeholders      Placeholder[]
  drafts            Draft[]

  @@index([status, createdAt(sort: Desc)])
}
```

### 新增 TemplateVersion 表

存储每次发布的完整快照。

```prisma
model TemplateVersion {
  id                String          @id @default(cuid())
  version           Int             // 自增版本号：1, 2, 3...
  fileName          String          // 存储文件名
  filePath          String          // 文件存储路径
  originalFileName  String          // 用户上传的原始文件名
  fileSize          Int
  publishedAt       DateTime        @default(now())

  // 占位符配置快照
  placeholderSnapshot Json          // PlaceholderItem[] 的 JSON 快照

  // 主数据关联快照
  dataTableId       String?
  dataTable         DataTable?      @relation(fields: [dataTableId], references: [id])
  fieldMapping      Json?

  // 发布者
  publishedById     String
  publishedBy       User            @relation(fields: [publishedById], references: [id])

  // 关联
  templateId        String
  template          Template        @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@unique([templateId, version])
  @@index([templateId, version(sort: Desc)])
}
```

### Placeholder 表

保持不变。Placeholder 是 Template 的编辑态占位符配置。发布时将当前配置序列化为 JSON 存入 TemplateVersion.placeholderSnapshot。

### Record 表调整

新增 `templateVersionId` 外键，记录是哪个版本生成的。

```prisma
model Record {
  // ... 现有字段 ...
  templateVersionId  String?
  templateVersion    TemplateVersion?  @relation(fields: [templateVersionId], references: [id])
}
```

### 枚举调整

```prisma
enum TemplateStatus {
  DRAFT
  PUBLISHED    // 替代 READY
  ARCHIVED
}
```

### 发布数据流

```
[编辑态 - Template]                      [发布态 - TemplateVersion]
  name                                       version: 1 (自增)
  description                                fileName: v1.docx
  originalFileName                           filePath: uploads/templates/{id}/v1.docx
  filePath (编辑中的文件)                     fileSize: 1024
  dataTableId                                placeholderSnapshot: [{key, label, ...}, ...]
  fieldMapping                               dataTableId: xxx
  placeholders[]                             fieldMapping: {...}
       │                                         publishedAt: 2026-03-27
       │  点击"发布"                              publishedById: admin
       ▼
  1. 复制文件: template.filePath → versions/{id}/v1.docx
  2. TemplateVersion.create({ ... })
  3. template.currentVersionId = 新版本.id
  4. template.status = PUBLISHED
```

## 分步向导

### 组件结构

新建和编辑模板共用 `TemplateWizard` 组件，通过 props 区分模式。

```
TemplateWizard (新建/编辑)
├── StepIndicator (步骤条：上传 → 配置 → 发布)
├── WizardStep1 (上传文件 & 基本信息)
├── WizardStep2 (配置占位符) — 复用 PlaceholderConfigTable
├── WizardStep3 (确认 & 发布)
└── 底部操作栏 (取消 / 上一步 / 下一步 / 暂存草稿 / 发布)
```

### Step 1：上传文件 & 基本信息

- **新建模式**：必填上传 .docx + 填写名称
- **编辑模式**：显示当前文件信息，可替换文件；名称和描述可修改
- 上传后自动在后台解析占位符，解析结果供 Step 2 展示

### Step 2：配置占位符

- 复用现有 `PlaceholderConfigTable` 组件
- 支持：解析占位符、Excel 导入、编辑标签/类型/必填/默认值/排序、配置数据源
- 无占位符时显示空状态提示
- 向导内保存为"暂存草稿"，不改变发布状态

### Step 3：确认发布

- 配置摘要：模板名称、文件名、占位符数量、关联数据表
- 两个按钮：
  - **暂存为草稿**：仅保存当前编辑状态，不创建版本
  - **发布版本**：创建 TemplateVersion 快照，version 自增

### 路由调整

| 现有路由 | 新路由 | 说明 |
|----------|--------|------|
| `/templates/new` | `/templates/new` | 向导模式（新建） |
| `/templates/[id]/configure` | `/templates/[id]/edit` | 向导模式（编辑），替代 configure |
| `/templates/[id]` | `/templates/[id]` | 详情页，展示当前版本信息 |

移除 `/templates/[id]/configure` 路由。

### 模板详情页调整

展示当前发布版本的信息：
- 基本信息（名称、描述）
- 当前版本号、发布时间、发布者
- 占位符列表（只读，来自版本快照或编辑态）
- 关联数据表信息
- 操作按钮：「编辑模板」（进入向导）、「填写表单」、「批量生成」
- 新增：「版本历史」按钮

### 版本历史面板（Dialog）

- 列出所有已发布版本（version、发布时间、发布者）
- 点击版本查看详情：占位符配置快照、关联数据表、文件信息
- 只读，不支持回退

## API 设计

### 新增接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/templates/[id]/publish` | 发布模板，创建版本快照 |
| GET | `/api/templates/[id]/versions` | 获取版本历史列表 |
| GET | `/api/templates/[id]/versions/[version]` | 获取版本详情（含占位符快照） |

### 修改的接口

| 方法 | 路径 | 变化 |
|------|------|------|
| PUT | `/api/templates/[id]/placeholders` | 不再自动 changeStatus，仅保存配置 |
| GET | `/api/templates` | 普通用户只返回 PUBLISHED 状态的模板 |
| GET | `/api/templates/[id]` | 返回数据增加 currentVersion 信息 |

### 发布接口详情

**POST /api/templates/[id]/publish**

权限：ADMIN

请求体：无

处理逻辑：
1. 校验模板存在且有占位符配置
2. 计算下一版本号（当前最大 version + 1，无历史则为 1）
3. 复制文件到版本目录
4. 序列化占位符配置为 JSON 快照
5. 创建 TemplateVersion 记录
6. 更新 Template 的 currentVersionId 和 status

响应：
```json
{
  "success": true,
  "data": {
    "version": 1,
    "publishedAt": "2026-03-27T00:00:00Z"
  }
}
```

### Service 层

新增 `src/lib/services/template-version.service.ts`：

```typescript
publishTemplate(templateId: string, userId: string): Promise<ServiceResult<TemplateVersion>>
getVersionHistory(templateId: string): Promise<ServiceResult<TemplateVersionListItem[]>>
getVersionDetail(templateId: string, version: number): Promise<ServiceResult<TemplateVersionDetail>>
```

修改 `src/lib/services/placeholder.service.ts`：
- `updatePlaceholders` 移除 `changeStatus(id, "READY")` 调用

## 文件存储

```
public/uploads/templates/{templateId}/
  draft.docx          // 编辑中的文件
  v1.docx             // 版本 1
  v2.docx             // 版本 2
  ...
```

## 模板列表权限

| 用户角色 | 可见模板 | 可用操作 |
|----------|----------|----------|
| 管理员 | 所有模板（DRAFT/PUBLISHED/ARCHIVED） | 编辑、发布、删除 |
| 普通用户 | 仅 PUBLISHED 模板 | 填写表单、批量生成 |

## 数据迁移

现有数据的迁移策略：

1. **已有 PUBLISHED（原 READY）模板**：
   - 创建 v1 版本快照（复制文件、序列化占位符）
   - 设置 currentVersionId
   - status 从 READY 改为 PUBLISHED

2. **DRAFT 模板**：不迁移，保持 DRAFT

3. **ARCHIVED 模板**：保持 ARCHIVED

4. **现有 Record**：templateVersionId 设为 null

## 影响范围

### 需要修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `prisma/schema.prisma` | 修改 | 新增 TemplateVersion，调整 Template/Record |
| `src/types/template.ts` | 修改 | 新增版本相关类型 |
| `src/lib/services/template.service.ts` | 修改 | 调整文件路径逻辑，移除自动 status 变更 |
| `src/lib/services/placeholder.service.ts` | 修改 | 移除 changeStatus 调用 |
| `src/lib/services/template-version.service.ts` | 新增 | 版本发布与查询 |
| `src/lib/file.service.ts` | 修改 | 新增版本文件复制方法 |
| `src/app/(dashboard)/templates/new/page.tsx` | 修改 | 使用向导组件 |
| `src/app/(dashboard)/templates/[id]/edit/page.tsx` | 新增 | 替代 configure 路由 |
| `src/app/(dashboard)/templates/[id]/configure/page.tsx` | 删除 | 合并到 edit |
| `src/app/(dashboard)/templates/[id]/page.tsx` | 修改 | 展示版本信息 |
| `src/app/(dashboard)/templates/page.tsx` | 修改 | 普通用户过滤 PUBLISHED |
| `src/components/templates/template-wizard.tsx` | 新增 | 向导容器 |
| `src/components/templates/version-history-dialog.tsx` | 新增 | 版本历史面板 |
| `src/components/templates/upload-form.tsx` | 修改 | 适配向导 Step 1 |
| `src/components/templates/placeholder-config-table.tsx` | 修改 | 适配向导 Step 2 |
| `src/app/api/templates/route.ts` | 修改 | 列表查询权限过滤 |
| `src/app/api/templates/[id]/route.ts` | 修改 | 返回版本信息 |
| `src/app/api/templates/[id]/publish/route.ts` | 新增 | 发布接口 |
| `src/app/api/templates/[id]/versions/route.ts` | 新增 | 版本列表 |
| `src/app/api/templates/[id]/versions/[version]/route.ts` | 新增 | 版本详情 |
| 生成文档相关 | 修改 | 引用 currentVersionId |
| 批量生成相关 | 修改 | 引用最新版本 |
| `src/lib/constants.ts` | 修改 | 更新 TEMPLATE_STATUS |

### 不受影响的模块

- 主数据管理（DataTable, DataRecord）
- 认证/权限
- 生成记录列表
- 草稿功能
- 仪表盘
