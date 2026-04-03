# 文档收集任务设计规范

## 概述

本设计文档定义“文档收集任务”模块的首版方案。该模块用于由任务发起人向指定人员发起文档收集，统一跟踪提交进度，保留提交历史版本，并支持对最新提交结果进行批量打包下载和批量重命名。

该模块在首版中作为独立业务模块实现，但数据结构应为后续与模板系统、生成记录联动保留扩展空间。

## 目标

- 支持发起人创建文档收集任务
- 支持任务创建时上传参考附件
- 支持任务创建时指定提交人员和截止日期
- 支持每个提交人反复上传同一提交槽位的文件，并保留历史版本
- 支持任务面板查看整体提交情况
- 支持发起人一键打包所有人员的最新提交
- 支持发起人通过自定义规则批量重命名导出文件

## 非目标

首版不包含以下能力：

- 审批流
- 催办、站内通知、邮件提醒
- 每个提交人多个独立文件槽位
- 结构化文件类型/大小规则配置
- 历史版本删除
- 回滚旧版本为当前版本
- 打包下载全部历史版本
- 与模板生成流程自动联动

## 功能范围

### 1. 发起任务

发起人创建任务时填写：

- 标题
- 提交要求说明
- 截止日期
- 指定提交人员
- 任务参考附件
- 批量下载文件命名规则
- 任务级自定义命名变量

### 2. 提交任务

收到任务的人员可在自己的任务视图中：

- 查看任务说明与参考附件
- 上传自己的提交文件
- 多次重复上传
- 查看自己的历史版本

每个提交人员在一个任务下只有一个提交槽位，最新上传版本自动成为当前版本。

### 3. 任务面板

发起人可在任务详情页查看：

- 总提交人数
- 未提交人数
- 已提交人数
- 逾期提交人数
- 每个人的最新提交文件、提交时间和版本数

### 4. 打包下载

发起人可一键打包下载所有已提交人员的最新版本文件，系统按自定义命名规则生成下载包内文件名。

## 设计原则

### KISS

- 用“任务 -> 提交人 -> 提交版本”直接表达业务，不引入通用附件元数据拼装版本链
- 当前版本通过指针引用最新版本，不维护重复快照
- 命名规则使用字符串模板，不引入复杂 DSL 或拖拽编辑器

### YAGNI

- 首版只支持“每人一个提交槽位”
- 首版只支持任务级文本要求，不做结构化校验规则
- 首版只打包最新版本，不支持历史全集导出

### DRY

- 提交状态统一由服务层计算
- 文件重命名逻辑复用现有文件名模板思路扩展实现
- 权限判断集中在服务层和路由层，不在组件中重复拼装

### SOLID

- `Task` 负责任务定义
- `Assignee` 负责人员与任务绑定及当前提交槽位
- `SubmissionVersion` 负责版本历史
- `Attachment` 负责任务参考附件

## 数据模型

### 枚举

```prisma
enum DocumentCollectionTaskStatus {
  ACTIVE
  CLOSED
}
```

说明：

- `ACTIVE` 表示任务进行中
- `CLOSED` 表示任务被发起人手动关闭，关闭后禁止继续上传
- 截止是否已过期不作为持久化状态，而是运行时根据 `dueAt` 计算

### `DocumentCollectionTask`

```prisma
model DocumentCollectionTask {
  id              String   @id @default(cuid())
  title           String
  instruction     String
  dueAt           DateTime
  status          DocumentCollectionTaskStatus @default(ACTIVE)
  renameRule      String
  renameVariables Json?
  createdById     String
  createdBy       User     @relation(fields: [createdById], references: [id])
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  attachments     DocumentCollectionAttachment[]
  assignees       DocumentCollectionAssignee[]

  @@index([createdById, createdAt(sort: Desc)])
  @@index([dueAt])
}
```

字段说明：

- `instruction` 为任务说明和提交要求文本
- `renameRule` 为打包下载文件命名规则
- `renameVariables` 存储任务级自定义命名变量键值对，例如 `{ "前缀": "法务部" }`

### `DocumentCollectionAttachment`

```prisma
model DocumentCollectionAttachment {
  id               String   @id @default(cuid())
  taskId           String
  task             DocumentCollectionTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  fileName         String
  originalFileName String
  storagePath      String
  fileSize         Int
  mimeType         String
  uploadedById     String
  uploadedBy       User     @relation(fields: [uploadedById], references: [id])
  createdAt        DateTime @default(now())

  @@index([taskId])
}
```

说明：

- 该表只存任务创建时上传的参考附件
- 不与提交版本复用，避免语义混淆

### `DocumentCollectionAssignee`

```prisma
model DocumentCollectionAssignee {
  id              String   @id @default(cuid())
  taskId          String
  task            DocumentCollectionTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  latestVersionId String?  @unique
  latestVersion   DocumentCollectionSubmissionVersion? @relation("LatestSubmissionVersion", fields: [latestVersionId], references: [id])
  submittedAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  versions        DocumentCollectionSubmissionVersion[]

  @@unique([taskId, userId])
  @@index([taskId])
  @@index([userId])
}
```

说明：

- `Assignee` 本身就是“每个提交人的提交槽位”
- `latestVersionId` 指向当前最新版本
- `submittedAt` 为当前最新版本的提交时间

### `DocumentCollectionSubmissionVersion`

```prisma
model DocumentCollectionSubmissionVersion {
  id               String   @id @default(cuid())
  assigneeId       String
  assignee         DocumentCollectionAssignee @relation(fields: [assigneeId], references: [id], onDelete: Cascade)
  version          Int
  fileName         String
  originalFileName String
  storagePath      String
  fileSize         Int
  mimeType         String
  submittedById    String
  submittedBy      User     @relation(fields: [submittedById], references: [id])
  submittedAt      DateTime @default(now())
  note             String?
  isLate           Boolean  @default(false)
  currentForAssignee DocumentCollectionAssignee? @relation("LatestSubmissionVersion")

  @@unique([assigneeId, version])
  @@index([assigneeId, submittedAt(sort: Desc)])
}
```

说明：

- `version` 在同一个 `assigneeId` 下递增
- `isLate` 固化上传当时是否逾期，作为历史事实保留
- 当前版本不额外复制存储，只通过 `latestVersionId` 指向最新版本

## 关系模型

```text
DocumentCollectionTask
  -> DocumentCollectionAttachment
  -> DocumentCollectionAssignee
       -> DocumentCollectionSubmissionVersion
```

关系语义：

- 一个任务有多个参考附件
- 一个任务有多个指定提交人
- 每个指定提交人有一个提交槽位和多个历史版本
- 提交槽位通过 `latestVersionId` 指向当前版本

## 核心业务规则

### 1. 提交槽位规则

- 每个任务中的每个用户只有一个提交槽位
- 新上传不会覆盖旧数据，而是生成新版本
- 当前版本永远等于最新上传版本
- 首版不支持手动切换当前版本

### 2. 截止规则

- 到期后仍允许上传
- 到期后上传的版本记为逾期版本
- 面板中逾期提交按当前最新版本判断
- 任务仅在被发起人手动关闭后禁止上传

### 3. 权限规则

- 发起人可查看任务全量信息、所有人历史版本、执行打包下载
- 指定提交人只可查看任务说明、参考附件、自己的提交记录
- 非发起人且非指定提交人不可访问任务内容
- 首版不提供管理员旁路权限

### 4. 命名规则

支持 4 类变量：

- 系统变量：`{序号}`、`{提交时间}`
- 任务变量：`{任务标题}`
- 提交人变量：`{姓名}`、`{邮箱}`
- 自定义变量：例如 `{前缀}`、`{批次}`

示例：

```text
{前缀}_{姓名}_{任务标题}_{序号}
```

若 `前缀 = 法务部`，则输出文件名示例：

```text
法务部_张三_合同扫描件收集_1.docx
```

规则约束：

- 自定义变量名由发起人创建任务时填写
- 自定义变量只在任务维度生效
- 若自定义变量与系统保留变量重名，创建任务时禁止保存
- 命名结果中的非法字符统一替换为 `_`
- 重名文件通过统一去重逻辑处理

## 页面设计

### 1. 任务列表页

路径：

```text
/collections
```

展示两个视角：

- 我发起的任务
- 指派给我的任务

列表项展示：

- 标题
- 截止日期
- 发起人
- 最新更新时间
- 我的提交状态或整体统计

### 2. 新建任务页

路径：

```text
/collections/new
```

表单字段：

- 标题
- 提交要求说明
- 截止日期时间
- 提交人员选择
- 任务参考附件上传
- 命名规则输入框
- 自定义命名变量键值对编辑区

命名规则区应展示可用变量并支持点击插入。

### 3. 任务详情页

路径：

```text
/collections/[id]
```

#### 发起人视角

展示区块：

- 基本信息
- 任务附件
- 提交统计
- 提交人列表
- 打包下载区

提交人列表字段：

- 姓名
- 状态
- 最新文件名
- 最新提交时间
- 历史版本数
- 操作：查看历史、下载当前版本

#### 提交人视角

展示区块：

- 任务说明
- 参考附件
- 我的当前提交
- 我的历史版本

操作：

- 上传新版本
- 下载当前版本
- 查看历史版本

### 4. 独立提交页

首版不提供独立提交页。提交人直接在任务详情页完成上传与历史版本查看，避免首版引入重复页面和重复逻辑。

## API 设计

### 1. `POST /api/collections`

创建任务。

请求方式建议：

- 使用 `multipart/form-data`
- 文本字段包括任务基础信息
- 文件字段包括任务参考附件

字段：

- `title`
- `instruction`
- `dueAt`
- `assigneeIds`
- `renameRule`
- `renameVariables`
- `attachments[]`

### 2. `GET /api/collections`

查询任务列表。

建议查询参数：

- `scope=created|assigned|all`
- `status=active|closed`
- `search=关键词`

响应应根据当前用户身份返回：

- 发起人视角的聚合统计
- 或当前用户在该任务下的提交状态

### 3. `GET /api/collections/[id]`

获取任务详情。

权限行为：

- 发起人返回全量任务详情、统计、assignee 列表
- 指定提交人只返回自己的提交上下文
- 无权限用户返回拒绝结果

### 4. `POST /api/collections/[id]/submissions`

提交新版本。

请求方式：

- `multipart/form-data`

字段：

- `file`
- `note` 可选

行为：

- 校验当前用户是该任务的指定提交人
- 为该 assignee 生成下一个版本号
- 保存文件
- 写入版本记录
- 更新 `latestVersionId` 和 `submittedAt`

### 5. `GET /api/collections/[id]/submissions`

获取版本历史。

建议参数：

- `assigneeId`

规则：

- 发起人可通过 `assigneeId` 查看任一提交人的版本历史
- 提交人只能查看自己的版本历史

### 6. `GET /api/collections/[id]/download`

下载打包结果。

规则：

- 仅发起人可调用
- 只打包每个 assignee 的最新版本
- 无提交文件时返回业务错误
- 文件丢失时整体失败并返回明细

### 7. `GET /api/collections/[id]/submissions/[versionId]/download`

下载单个版本文件。

规则：

- 发起人可下载该任务下任意版本
- 提交人仅可下载自己的版本

## 服务层设计

建议新增以下服务：

### `document-collection-task.service.ts`

职责：

- 创建任务
- 查询任务列表
- 查询任务详情
- 关闭任务

### `document-collection-submission.service.ts`

职责：

- 上传新版本
- 获取版本历史
- 计算 assignee 当前状态

### `document-collection-download.service.ts`

职责：

- 构造命名变量上下文
- 应用命名规则
- 处理同名去重
- 生成 zip 包

### `document-collection-permission.service.ts`

职责：

- 校验发起人权限
- 校验 assignee 权限
- 对详情、下载、版本查看等动作统一做权限判断

## 状态计算

当前提交状态不持久化，统一由服务层计算：

- 无 `latestVersionId` -> `PENDING`
- 有 `latestVersionId` 且 `latestVersion.isLate = false` -> `SUBMITTED`
- 有 `latestVersionId` 且 `latestVersion.isLate = true` -> `LATE`

统计指标：

- 总人数 = `assignees.length`
- 已提交人数 = 状态为 `SUBMITTED` 或 `LATE` 的人数
- 未提交人数 = 状态为 `PENDING` 的人数
- 逾期提交人数 = 状态为 `LATE` 的人数
- 提交率 = 已提交人数 / 总人数

## 文件存储设计

建议沿用当前项目本地文件存储方式，在 `public/uploads` 下新增独立目录：

```text
public/uploads/collections/tasks
public/uploads/collections/submissions
public/uploads/collections/packages
```

建议约定：

- 任务附件按任务维度存储
- 提交版本按版本记录 ID 存储文件
- 打包结果按任务 ID 或下载任务 ID 存储 zip 文件

文件保存原则：

- 先生成记录 ID，再按 ID 保存文件
- 数据库事务失败时补偿删除已写入文件
- zip 生成失败时删除不完整压缩包

## 异常处理

### 权限异常

- 未登录：`401`
- 无权限动作：`403`
- 详情不可见任务：统一按 `404` 返回，避免暴露任务存在性

### 上传异常

- 无文件：返回校验错误
- 版本号竞争：通过事务保证版本号递增一致
- 文件落盘成功但事务失败：补偿删除文件

### 下载异常

- 无人提交：返回业务错误，不生成空 zip
- 最新版本物理文件丢失：整次打包失败并返回缺失信息
- 文件重名：自动加后缀去重

## 组件设计

建议新增组件：

- `collection-task-form`
- `collection-assignee-picker`
- `collection-attachments-upload`
- `collection-rename-rule-editor`
- `collection-status-badge`
- `collection-assignee-table`
- `collection-submission-upload`
- `collection-version-history`

拆分原则：

- 表单编辑与结果展示分离
- 上传区与历史版本区分离
- 命名规则编辑器独立，便于后续复用

## 测试策略

### 服务层测试

至少覆盖：

- 创建任务时同时创建 assignee
- 同一 assignee 多次上传时版本号递增
- `latestVersionId` 始终指向最新版本
- 截止前上传为正常提交
- 截止后上传为逾期提交
- 打包仅包含最新版本
- 自定义命名变量正确替换
- 文件重名自动去重

### 路由测试

至少覆盖：

- 未登录访问被拒绝
- 发起人可获取全量任务详情
- 提交人只能获取自己的提交上下文
- 上传接口成功生成新版本
- 打包接口权限校验正确

### 组件测试

优先覆盖：

- 命名规则编辑器变量插入与预览
- 状态标签渲染
- 历史版本列表展示

## MVP 范围

### 必做

- 创建文档收集任务
- 上传任务参考附件
- 指定提交人
- 提交人上传新版本
- 查看历史版本
- 截止后允许上传并标记逾期
- 发起人查看任务面板
- 发起人一键打包下载最新版本
- 支持任务级自定义命名变量

### 不做

- 催办和通知
- 审批流
- 每人多文件槽位
- 历史版本删除
- 历史版本回滚
- 结构化上传规则配置
- 历史全集打包
- 与模板系统自动联动

## 推荐实施顺序

1. Prisma 数据模型与迁移
2. 服务层与权限校验
3. 任务创建接口与上传接口
4. 任务详情聚合接口
5. 打包下载接口
6. 发起人面板 UI
7. 提交人上传和历史版本 UI
8. 命名规则编辑器与预览
9. 测试补齐

## 后续扩展点

- 在 `DocumentCollectionTask` 上增加 `templateId`，与模板系统建立可选关联
- 在 `SubmissionVersion` 上增加审批状态，扩展为收集 + 审核流
- 在 `Assignee` 上增加提醒记录，扩展催办能力
- 在任务维度增加模板化能力，支持重复创建同类收集任务
