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

**调整字段**：
- `filePath`：改为必填，始终存储编辑中的文件路径。从创建（向导 Step 1 上传）到编辑完成（向导 Step 3 发布），编辑态文件始终保留在磁盘上。发布时复制到版本目录，原始编辑文件不删除。

**新增字段**：
- `currentVersionId` (`String?`)：指向当前生效的 TemplateVersion
- `dataTableId` (`String?`)：保留在 Template 上，表示当前编辑态的关联数据表
- `fieldMapping` (`Json?`)：保留在 Template 上，表示当前编辑态的字段映射

> **设计决策**：`dataTableId` 和 `fieldMapping` 保留在 Template 而非移到 TemplateVersion。原因：
> 1. 这些是编辑态配置，与 Placeholder 同理留在 Template 上
> 2. 移除它们会破坏大量现有代码引用（template.service.ts、batch-generation.service.ts、draft.service.ts）
> 3. TemplateVersion 通过快照 `placeholderSnapshot` 和 `fieldMapping` 保存发布时的完整配置

**移除字段**：
- `fileName`：可从 filePath 中提取，减少冗余

**status 枚举调整**：

```
现有：DRAFT → READY → ARCHIVED
改为：DRAFT → PUBLISHED → ARCHIVED

DRAFT     = 未发布（从未发布，或发布后修改了模板）
PUBLISHED = 已发布（有至少一个版本，currentVersionId 不为空）
ARCHIVED  = 已归档
```

> **枚举迁移策略**：PostgreSQL 枚举值修改需要分步执行 SQL：
> 1. `ALTER TYPE "TemplateStatus" ADD VALUE IF NOT EXISTS 'PUBLISHED'`
> 2. `UPDATE "Template" SET status = 'PUBLISHED' WHERE status = 'READY'`
> 3. 修改 schema.prisma 移除 `READY`，执行 `prisma db push`
> 4. `ALTER TYPE "TemplateStatus" RENAME TO "TemplateStatus_old"` + 重建枚举（如果 prisma db push 不支持自动删除旧值）

**Template 模型**：

```prisma
model Template {
  id                String            @id @default(cuid())
  name              String
  description       String?
  originalFileName  String            @default("")
  fileSize          Int               @default(0)
  filePath          String            // 编辑中的文件路径（始终有值）
  status            TemplateStatus    @default(DRAFT)
  currentVersionId  String?
  currentVersion    TemplateVersion?  @relation("CurrentVersion", fields: [currentVersionId], references: [id])
  dataTableId       String?
  dataTable         DataTable?        @relation(fields: [dataTableId], references: [id])
  fieldMapping      Json?
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
  placeholderSnapshot Json          // PlaceholderSnapshotItem[] 的 JSON 快照

  // 主数据关联快照（发布时从 Template 复制）
  dataTableId       String?
  dataTable         DataTable?      @relation(fields: [dataTableId], references: [id])
  fieldMapping      Json?

  // 发布者
  publishedById     String
  publishedBy       User            @relation(fields: [publishedById], references: [id])

  // 关联
  templateId        String
  template          Template        @relation(fields: [templateId], references: [id], onDelete: Cascade)
  records           Record[]
  batchGenerations  BatchGeneration[]

  @@unique([templateId, version])
  @@index([templateId, version(sort: Desc)])
}
```

`placeholderSnapshot` 的 TypeScript 类型：

```typescript
interface PlaceholderSnapshotItem {
  key: string;
  label: string;
  inputType: "TEXT" | "TEXTAREA";
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  enablePicker: boolean;
  sourceTableId: string | null;
  sourceField: string | null;
  snapshotVersion: 1;  // 快照格式版本，便于未来兼容
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

### BatchGeneration 表调整

新增 `templateVersionId` 外键，记录批量生成使用的模板版本。批量生成开始时锁定当前版本。

```prisma
model BatchGeneration {
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
  filePath (编辑中的文件，保留)               fileSize: 1024
  dataTableId                                placeholderSnapshot: [{key, label, ..., snapshotVersion: 1}, ...]
  fieldMapping                               dataTableId: xxx (快照)
  placeholders[]                             fieldMapping: {...} (快照)
       │                                         publishedAt: 2026-03-27
       │  点击"发布"                              publishedById: admin
       ▼
  整个流程在 Prisma $transaction 中执行：
  1. $queryRaw`SELECT ... FOR UPDATE` 锁定模板行
  2. 计算下一版本号：MAX(version) + 1（无历史则为 1）
  3. 复制文件: template.filePath → uploads/templates/{id}/v{version}.docx
  4. 序列化占位符配置为 JSON 快照
  5. 创建 TemplateVersion 记录（含 dataTableId/fieldMapping 快照）
  6. 更新 Template: currentVersionId = 新版本.id, status = PUBLISHED
  7. 如有 Record 表引用，也在此事务中记录 templateVersionId
```

> **并发安全**：发布操作使用 Prisma 交互式事务（interactive transaction），在事务开始时通过 `SELECT FOR UPDATE` 锁定模板行，防止两个管理员同时发布产生版本号冲突。`@@unique([templateId, version])` 作为最终安全网。

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
- **文件保存时机**：Step 1 上传时立即保存到服务端 `uploads/templates/{templateId}/draft.docx`（替换旧文件），不再需要"在后续步骤放弃时清理"，因为编辑态文件始终保留

### Step 2：配置占位符

- 复用现有 `PlaceholderConfigTable` 组件
- 支持：解析占位符、Excel 导入、编辑标签/类型/必填/默认值/排序、配置数据源
- 无占位符时显示空状态提示
- 占位符保存为服务端实时保存，不依赖向导的"暂存草稿"按钮

### Step 3：确认发布

- 配置摘要：模板名称、文件名、占位符数量、关联数据表
- 两个按钮：
  - **返回编辑**：返回 Step 2 继续修改
  - **发布版本 vX**：调用发布接口，创建 TemplateVersion 快照

> **简化**：移除"暂存为草稿"按钮。Step 1 上传文件和 Step 2 保存占位符都是即时保存的，不存在"丢失进度"的风险。向导关闭即回到详情页。

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
- 版本数量预期较小（<100），暂不需要分页

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

处理逻辑（在 Prisma 交互式事务中执行）：
1. `SELECT ... FOR UPDATE` 锁定模板行
2. 校验模板存在且有占位符配置（至少 1 个）
3. 计算下一版本号：`MAX(version) + 1`（无历史则为 1）
4. 复制文件到版本目录 `uploads/templates/{templateId}/v{version}.docx`
5. 序列化占位符配置为 JSON 快照
6. 创建 TemplateVersion 记录（含 dataTableId/fieldMapping 快照）
7. 更新 Template 的 currentVersionId 和 status = PUBLISHED

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

### 生成文档适配

现有 `record.service.ts` 的 `generateDocument` 和 `batch-generation.service.ts` 的 `generateBatch` 直接读取 `template.filePath`。重构后需改为：

- **单次生成**：通过 `template.currentVersion.filePath` 获取发布版本的文件路径
- **批量生成**：通过 `template.currentVersion.filePath` 获取文件路径，同时在 BatchGeneration 记录中保存 `templateVersionId`
- **Record 创建**：创建 Record 时记录 `templateVersionId = template.currentVersionId`

```typescript
// record.service.ts - generateDocument 改造
const template = await db.template.findUnique({
  where: { id: templateId },
  include: { currentVersion: true },  // 新增
});
const filePath = template.currentVersion?.filePath ?? template.filePath;

// batch-generation.service.ts - generateBatch 改造
const template = await db.template.findUnique({
  where: { id: templateId },
  include: { currentVersion: true },
});
const filePath = template.currentVersion?.filePath ?? template.filePath;
// 创建 BatchGeneration 时记录 templateVersionId
```

### 删除模板适配

现有 `deleteTemplate` 只删除单个文件。重构后需清理整个模板目录：

```typescript
// file.service.ts 新增
async deleteTemplateDir(templateId: string): Promise<void> {
  const dir = path.join(UPLOAD_DIR, "templates", templateId);
  await fs.rm(dir, { recursive: true, force: true });
}

// template.service.ts - deleteTemplate 改造
async deleteTemplate(id: string) {
  // ... 级联删除数据库记录（TemplateVersion onDelete: Cascade 会自动处理）
  await deleteTemplateDir(id);  // 清理磁盘上所有版本文件
}
```

### Draft 兼容

Draft 表通过 `templateId` 关联 Template。普通用户的 Draft 列表中可能包含引用了已归档/草稿模板的旧 Draft。**保持现有行为**：Draft 列表不做模板状态过滤，但在前端展示时标记模板状态（如"模板已归档"）。

### Service 层

新增 `src/lib/services/template-version.service.ts`：

```typescript
publishTemplate(templateId: string, userId: string): Promise<ServiceResult<TemplateVersion>>
getVersionHistory(templateId: string): Promise<ServiceResult<TemplateVersionListItem[]>>
getVersionDetail(templateId: string, version: number): Promise<ServiceResult<TemplateVersionDetail>>
```

修改 `src/lib/services/placeholder.service.ts`：
- `updatePlaceholders` 移除 `changeStatus(id, "READY")` 调用

修改 `src/lib/services/record.service.ts`：
- `generateDocument` 改为引用 `template.currentVersion.filePath`
- `createRecord` 时记录 `templateVersionId`

修改 `src/lib/services/batch-generation.service.ts`：
- `generateBatch` 改为引用 `template.currentVersion.filePath`
- 创建 BatchGeneration 时记录 `templateVersionId`

修改 `src/lib/services/template.service.ts`：
- `deleteTemplate` 清理整个模板目录（包含所有版本文件）

## 文件存储

```
public/uploads/templates/{templateId}/
  draft.docx          // 编辑中的文件（始终存在）
  v1.docx             // 版本 1
  v2.docx             // 版本 2
  ...
```

`file.service.ts` 新增方法：
- `saveTemplateDraft(templateId, buffer, originalName)` — 保存编辑态文件
- `copyToVersion(templateId, version)` — 复制编辑态文件到版本目录
- `deleteTemplateDir(templateId)` — 删除整个模板目录（含所有版本文件）

## 模板列表权限

| 用户角色 | 可见模板 | 可用操作 |
|----------|----------|----------|
| 管理员 | 所有模板（DRAFT/PUBLISHED/ARCHIVED） | 编辑、发布、删除 |
| 普通用户 | 仅 PUBLISHED 模板 | 填写表单、批量生成 |

## 数据迁移

现有数据的迁移策略（编写为 Prisma seed 脚本或手动 SQL）：

### Step 1：Schema 变更

1. 在 PostgreSQL 中添加新枚举值：`ALTER TYPE "TemplateStatus" ADD VALUE IF NOT EXISTS 'PUBLISHED'`
2. 执行 `prisma db push` 创建 TemplateVersion 表、Record/BatchGeneration 新增字段、Template 新增 currentVersionId 字段

### Step 2：数据迁移脚本

1. **已有 READY 模板**：
   - 复制文件：`templates/{id}.docx` → `templates/{id}/draft.docx`（编辑态）和 `templates/{id}/v1.docx`（版本 1）
   - 序列化占位符配置为 JSON
   - 创建 TemplateVersion 记录（version=1, filePath=新路径, placeholderSnapshot=JSON, dataTableId/fieldMapping 从 Template 复制）
   - 更新 Template：currentVersionId = 新版本 ID，filePath = 新路径，status = PUBLISHED

2. **DRAFT 模板**：
   - 迁移文件路径：`templates/{id}.docx` → `templates/{id}/draft.docx`
   - 更新 Template.filePath
   - 保持 DRAFT 状态

3. **ARCHIVED 模板**：
   - 迁移文件路径：同 DRAFT
   - 如果有使用过的版本，创建 v1 快照（可选，归档模板可能没有活跃版本）

4. **现有 Record**：templateVersionId 设为对应模板的 currentVersionId（如果有的话）

5. **现有 BatchGeneration**：templateVersionId 设为对应模板的 currentVersionId

### Step 3：清理枚举

1. 修改 schema.prisma 移除 `READY` 枚举值
2. `ALTER TYPE "TemplateStatus" DROP VALUE 'READY'`（需确保无数据引用）
3. 执行 `prisma db push` 验证

## 影响范围

### 需要修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `prisma/schema.prisma` | 修改 | 新增 TemplateVersion，调整 Template/Record/BatchGeneration |
| `src/types/template.ts` | 修改 | 新增版本相关类型，调整 TemplateListItem |
| `src/types/placeholder.ts` | 修改 | 新增 PlaceholderSnapshotItem 类型 |
| `src/validators/template.ts` | 修改 | 新增发布相关校验 schema |
| `src/lib/services/template.service.ts` | 修改 | 调整文件路径逻辑，移除自动 status 变更，deleteTemplate 清理版本文件 |
| `src/lib/services/placeholder.service.ts` | 修改 | 移除 changeStatus 调用 |
| `src/lib/services/template-version.service.ts` | 新增 | 版本发布与查询（事务内执行） |
| `src/lib/services/record.service.ts` | 修改 | generateDocument 引用 currentVersion，createRecord 记录 templateVersionId |
| `src/lib/services/batch-generation.service.ts` | 修改 | generateBatch 引用 currentVersion，记录 templateVersionId |
| `src/lib/services/draft.service.ts` | 修改 | 适配 Template.filePath 路径变更 |
| `src/lib/file.service.ts` | 修改 | 新增 saveTemplateDraft/copyToVersion/deleteTemplateDir |
| `src/lib/constants.ts` | 修改 | 更新 TEMPLATE_STATUS |
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
| `prisma/seed.ts` | 修改 | 添加数据迁移逻辑 |

### 不受影响的模块

- 主数据管理（DataTable, DataRecord）
- 认证/权限核心逻辑
- 草稿功能（仅文件路径适配）
- 仪表盘
