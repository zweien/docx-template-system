# Issue #119 设计方案：甘特图增强（依赖 + 拖拽 + 里程碑 + 缩放平移）

## 1. 背景与目标

当前 `TimelineView` 仅支持只读展示，缺少任务依赖、拖拽改期、里程碑、缩放与导航能力。  
本方案目标是在保持现有 `DataRecord` 主数据模型不变的前提下，引入可复用的“任务依赖通用能力”，并在 Timeline 中落地完整甘特交互。

## 2. 已确认约束

- 依赖库：选择免费可商用方案，采用 `frappe-gantt`。
- 能力范围：本次按完整范围交付，不做裁剪。
- 数据层策略：通用能力优先，不做仅 Timeline 私有实现。
- 依赖边属性：`type`（首版仅 `FS`）、`lagDays`、`required`。
- 任务归属：继续使用 `DataRecord`，新增依赖边模型关联记录。
- 里程碑：使用布尔字段（`BOOLEAN`）表达，通过视图配置选择字段。
- 冲突策略：宽松模式，允许保存并高亮冲突。
- 缩放层级：`week / month / quarter`。
- 平移交互：空白区拖拽平移 + 左右按钮步进。
- 依赖线视觉：`required=true` 实线，`required=false` 虚线，冲突叠加红色。

## 3. 架构方案（推荐：分层增量）

采用四层递进，降低一次性重构风险：

1. 数据层：Prisma 模型、服务、API、约束校验
2. 渲染层：`frappe-gantt` 接入与视图配置扩展
3. 交互层：拖拽改期、里程碑交互、平移缩放
4. 约束层：依赖冲突检测与可视化提示

每层可独立验证，失败可局部回滚。

## 4. 数据模型设计

### 4.1 新增模型：`TaskDependency`

字段：

- `id: String`（主键）
- `tableId: String`（归属表）
- `successorRecordId: String`（后续任务）
- `predecessorRecordId: String`（前置任务）
- `type: String`（首版允许值：`FS`）
- `lagDays: Int`（可正可负）
- `required: Boolean`
- `createdAt: DateTime`
- `updatedAt: DateTime`

约束与索引：

- 唯一键：`(successorRecordId, predecessorRecordId, type)`
- 索引：`tableId`、`successorRecordId`、`predecessorRecordId`
- 业务约束：禁止 `successorRecordId == predecessorRecordId`（self-loop）

### 4.2 里程碑表达

- 不新增专用字段类型，使用已有 `BOOLEAN` 字段。
- 在 `viewOptions` 中新增 `milestoneFieldKey` 指向该字段。
- 当该字段为 `true` 时，任务按单点里程碑处理（`start=end`）。

## 5. API 与服务设计

### 5.1 API

- `GET /api/data-tables/:id/dependencies`
  - 返回当前表全部依赖边
- `PUT /api/data-tables/:id/dependencies`
  - 批量 upsert 依赖边
- `DELETE /api/data-tables/:id/dependencies/:depId`
  - 删除依赖边

### 5.2 服务层

- `listDependencies(tableId)`
- `upsertDependencies(tableId, payload)`
- `deleteDependency(tableId, depId)`
- `detectDependencyConflicts({ records, dependencies, startField, endField })`

冲突规则（`FS` + required）：

- 约束：`successor.start >= predecessor.end + lagDays`
- 仅 `required=true` 参与冲突判定

## 6. Timeline 渲染与交互设计

### 6.1 组件分层

- `timeline-view.tsx`：装配字段、记录、依赖、视图配置
- `timeline-adapter.ts`：转换 `DataRecord + TaskDependency -> frappe-gantt tasks/links`
- `timeline-conflicts.ts`：冲突计算与样式标记
- `timeline-config.tsx`：新增里程碑字段和依赖开关配置

### 6.2 渲染规则

- 缩放：仅 `week/month/quarter`
- 任务条：普通任务按 `start/end` 渲染
- 里程碑：菱形标记，单点任务
- 依赖线样式：
  - `required=true`：实线
  - `required=false`：虚线
  - 冲突：线条红色高亮

### 6.3 交互规则

- 拖拽任务（平移/拉伸）：
  - 本地乐观更新
  - 调用 `onPatchRecord` 写回开始/结束日期
  - 失败回滚并提示
- 里程碑：
  - 仅允许移动，不允许拉伸
- 平移：
  - 空白区域拖拽平移
  - 左右按钮按当前 scale 步进

## 7. 错误处理与边界策略

- 日期字段缺失或无效：任务过滤并在配置区提示计数
- self-loop：后端拒绝写入
- 循环依赖：首版允许写入但标记风险，不做自动排程
- 跨表依赖：后端拒绝（`tableId` 必须一致）

## 8. 测试策略

### 8.1 单元测试

- `timeline-adapter`：任务映射、里程碑映射、依赖映射
- `timeline-conflicts`：FS + lagDays 冲突判定（负/零/正）

### 8.2 组件测试

- `TimelineView` 缩放、平移、配置切换
- 拖拽触发 `onPatchRecord` 参数校验
- 冲突时任务/依赖样式 class 校验

### 8.3 API 测试

- 依赖边 CRUD、唯一约束、self-loop 拒绝、跨表拒绝

### 8.4 E2E 主链路

- 创建 A/B，建立 `A -> B (required, FS)`
- 拖拽 B 到非法位置后出现冲突高亮
- 调整 B 到合法位置冲突消失
- 里程碑显示为菱形并可移动
- `week/month/quarter` 缩放与平移可用

## 9. 验收标准映射（Issue #119）

- 拖拽任务条可调整日期：覆盖
- 依赖连线正确渲染：覆盖
- 前置任务变更时提示冲突：覆盖（宽松模式）
- 时间轴可缩放和平移：覆盖（week/month/quarter + 拖拽/按钮）
- 里程碑支持：覆盖（布尔字段驱动）

## 10. 实施顺序

1. Prisma migration + 依赖 API
2. Timeline 接入 `frappe-gantt`（只读渲染先通）
3. 拖拽改期 + 里程碑交互
4. 冲突检测 + 样式高亮
5. 测试补齐与验收
