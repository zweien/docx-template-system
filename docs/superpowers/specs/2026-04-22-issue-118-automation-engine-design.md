# Issue #118 自动化引擎设计

## 背景

目标是在现有数据表系统中新增第一期自动化能力，支持用户定义“当 X 发生时，执行 Y”的工作流。该能力需要覆盖事件触发、定时触发、手动触发、条件分支、动作执行、日志查询和画布式编辑器。

本期采用受约束的画布模型：前端是画布编辑器，后端执行的是稳定 DSL，而不是任意节点图。这样可以在保留可视化体验的同时控制第一期复杂度。

## 范围

本期必须支持：

- 触发器
  - 记录创建
  - 记录更新
  - 记录删除
  - 字段值变化
  - 定时触发（每天 / 每周 / 每月）
  - 手动触发
- 条件
  - 字段值比较：等于、不等于、包含、大于、小于
  - 组合条件：`AND` / `OR`
  - `else` 分支
- 动作
  - 更新字段值
  - 创建新记录
  - 调用 Webhook
  - 添加评论
- 管理界面
  - 自动化列表
  - 画布编辑页
  - 执行日志页
- 运行时
  - 进程内队列
  - 持久化运行记录
  - 手动触发入口
  - 定时扫描入口

本期明确不做：

- 邮件通知
- 任意图编排、循环、并行执行
- 失败重试、死信队列、补偿事务
- 服务重启后的未完成任务补跑
- 自动化版本历史

## 设计原则

- 画布交互和后端执行解耦。前端编辑节点图，后端只消费受约束 DSL。
- 自动化运行必须可观测。每次执行和每个动作步骤都必须落库。
- 条件语义尽量复用现有数据表筛选操作符，避免维护两套条件系统。
- 第一期严格限制流程拓扑，避免实现通用流程引擎。

## 总体方案

自动化系统由五个部分组成：

1. 自动化定义存储
2. 自动化执行调度
3. 条件求值和动作执行器
4. 触发器入口
5. 自动化管理 UI

运行路径如下：

1. 用户在画布编辑器中编辑自动化。
2. 前端将节点图归约为受约束 DSL，调用保存 API。
3. 触发事件产生后，系统创建 `AutomationRun` 并将任务放入进程内队列。
4. 执行器读取 DSL，构建上下文，进行条件判断。
5. 根据判断结果执行 `then` 或 `else` 动作链。
6. 每一步都写入 `AutomationRunStep`，最终更新 `AutomationRun` 状态。

## 数据模型

### Prisma 模型

新增模型：

#### `Automation`

- `id`
- `tableId`
- `name`
- `description`
- `enabled`
- `triggerType`
- `definitionVersion`
- `definition`：JSON，保存可执行 DSL 和必要画布布局
- `createdById`
- `updatedById`
- `createdAt`
- `updatedAt`

说明：

- 第一阶段不拆 `AutomationStep` 表，避免 DSL 和节点表双写。
- `definitionVersion` 用于未来 DSL 结构升级。

#### `AutomationRun`

- `id`
- `automationId`
- `status`：`PENDING | RUNNING | SUCCEEDED | FAILED | CANCELED`
- `triggerSource`：`EVENT | SCHEDULE | MANUAL`
- `triggerPayload`：JSON
- `contextSnapshot`：JSON
- `startedAt`
- `finishedAt`
- `durationMs`
- `errorCode`
- `errorMessage`
- `createdAt`

说明：

- `triggerPayload` 保存原始触发信息。
- `contextSnapshot` 保存执行时归一化上下文，便于排障。

#### `AutomationRunStep`

- `id`
- `runId`
- `nodeId`
- `stepType`
- `branch`：`THEN | ELSE`
- `status`：`PENDING | RUNNING | SUCCEEDED | FAILED | SKIPPED`
- `input`：JSON
- `output`：JSON
- `errorCode`
- `errorMessage`
- `startedAt`
- `finishedAt`
- `durationMs`

说明：

- `nodeId` 对应 DSL 里的动作节点 id，不依赖独立步骤表。

### 类型层

新增：

- `src/types/automation.ts`

包含：

- `AutomationItem`
- `AutomationDetail`
- `AutomationTriggerType`
- `AutomationRunItem`
- `AutomationRunStepItem`
- `AutomationDefinition`
- `AutomationConditionGroup`
- `AutomationActionNode`

## DSL 结构

自动化定义采用单根结构：

```ts
type AutomationDefinition = {
  version: 1;
  canvas: {
    nodes: Array<{ id: string; type: string; x: number; y: number }>;
    edges: Array<{ source: string; target: string; handle?: string }>;
  };
  trigger: AutomationTrigger;
  condition: AutomationConditionGroup | null;
  thenActions: AutomationActionNode[];
  elseActions: AutomationActionNode[];
};
```

### 触发器

```ts
type AutomationTrigger =
  | { type: "record_created" }
  | { type: "record_updated"; fieldKeys?: string[] }
  | { type: "record_deleted" }
  | { type: "field_changed"; fieldKey: string; from?: unknown; to?: unknown }
  | { type: "schedule"; schedule: { mode: "daily" | "weekly" | "monthly"; time: string; weekday?: number; dayOfMonth?: number } }
  | { type: "manual" };
```

### 条件树

```ts
type AutomationConditionGroup = {
  operator: "AND" | "OR";
  conditions: Array<AutomationCondition | AutomationConditionGroup>;
};
```

条件项字段路径采用受限上下文：

- `record.<fieldKey>`
- `previousRecord.<fieldKey>`
- `changedFields`
- `triggerSource`

### 动作

```ts
type AutomationActionNode =
  | { id: string; type: "update_field"; fieldKey: string; value: unknown }
  | { id: string; type: "create_record"; tableId: string; values: Record<string, unknown> }
  | { id: string; type: "call_webhook"; url: string; method: "POST" | "PUT"; headers?: Record<string, string>; body?: unknown }
  | { id: string; type: "add_comment"; target: "current_record"; content: string };
```

### 画布约束

为了让后端执行保持简单，画布必须满足：

- 仅允许 1 个 `trigger` 节点
- 仅允许 1 个根 `condition` 节点
- `then` 和 `else` 只能是线性动作链
- 不允许回环
- 不允许多个条件节点串联成任意图
- 不允许并行动作分叉

前端画布负责表达，保存前做拓扑校验，后端再次做结构校验。

## 运行时设计

### 统一执行上下文

运行时上下文：

```ts
type AutomationExecutionContext = {
  automationId: string;
  tableId: string;
  record: Record<string, unknown> | null;
  previousRecord: Record<string, unknown> | null;
  changedFields: string[];
  triggerSource: "EVENT" | "SCHEDULE" | "MANUAL";
  triggeredAt: string;
  actor: { id: string | null };
};
```

### 队列模型

第一期使用进程内队列：

- API / service 层只负责 `enqueueAutomationRun`
- 队列消费者按顺序拉取并执行
- 同一 run 内动作串行执行
- 不做崩溃恢复

实现建议：

- 新增 `src/lib/services/automation-dispatcher.service.ts`
- 内部维护简单任务队列和并发上限
- 默认并发可设为 `1` 或一个较小值

### 触发入口

#### 数据事件入口

在以下 service 内触发自动化派发：

- `createRecord`
- `updateRecord`
- `deleteRecord`

入口参数统一为：

- `tableId`
- `record`
- `previousRecord`
- `changedFields`
- `triggerType`
- `actorId`

#### 定时触发入口

- 使用 `node-cron`
- 新增 `automation-scheduler.service.ts`
- 周期扫描启用的 `schedule` 自动化并产生 run

#### 手动触发入口

- 提供受鉴权保护的 API
- 用户在自动化详情页点“立即运行”后触发

### 条件求值

条件求值器新增：

- `src/lib/services/automation-condition.service.ts`

设计要求：

- 复用现有数据表 filter operator 语义
- 支持递归 group 求值
- 对 `changedFields` 和 `field_changed` 提供专门 helper

### 动作执行器

新增：

- `automation-action-executors/update-field.ts`
- `automation-action-executors/create-record.ts`
- `automation-action-executors/call-webhook.ts`
- `automation-action-executors/add-comment.ts`

统一接口：

```ts
type AutomationActionExecutor = (params: {
  action: AutomationActionNode;
  context: AutomationExecutionContext;
  runId: string;
}) => Promise<ServiceResult<Record<string, unknown> | null>>;
```

失败策略：

- 任一步骤失败，当前 run 标记 `FAILED`
- 后续步骤标记 `SKIPPED`
- 不自动重试

## API 设计

新增路由：

- `GET /api/automations`
- `POST /api/automations`
- `GET /api/automations/[id]`
- `PATCH /api/automations/[id]`
- `DELETE /api/automations/[id]`
- `POST /api/automations/[id]/toggle`
- `POST /api/automations/[id]/run`
- `GET /api/automations/[id]/runs`
- `GET /api/automations/runs/[runId]`

实现遵循仓库现有三层模式：

- `src/types/automation.ts`
- `src/validators/automation.ts`
- `src/lib/services/automation-*.service.ts`
- `src/app/api/automations/**`

## UI 设计

### 1. 自动化列表页

建议新增路由：

- `/automations`

功能：

- 展示名称、归属表、触发器类型、启用状态、最近运行状态
- 支持新建、启用/禁用、删除、进入编辑

### 2. 自动化编辑页

建议新增路由：

- `/automations/[id]`

结构：

- 左侧：节点库
- 中间：画布
- 右侧：选中节点配置面板

节点类型：

- `Trigger`
- `Condition`
- `Action`

右侧配置面板按节点类型动态变化：

- Trigger 配置
- Condition 配置
- Action 配置

保存前校验：

- 缺失 trigger
- 缺失必要配置
- 非法连线
- 多 trigger
- `then` / `else` 非线性结构

### 3. 日志页

建议放在：

- 自动化详情页内 tab

展示：

- 每次 run 的状态、触发来源、耗时、开始时间
- 点击 run 查看 step 详情

## 通知与错误处理

本期不做邮件通知，但执行失败需要可见：

- UI 日志页显示失败摘要
- 自动化列表显示最近一次运行状态
- 可以复用现有 `Notification` 能力，在后续阶段补“自动化失败通知”

## 安全约束

- Webhook 需要显式限制方法，仅允许 `POST` / `PUT`
- Header 先允许文本键值，不支持 secret vault
- 手动触发和编辑自动化都必须校验表级权限
- 自动化动作只允许作用于用户有权限访问的表

## 测试策略

### 单元测试

- 条件树求值
- `field_changed` 判断
- 每类 action executor
- 运行器失败中止逻辑

### 集成测试

- 记录创建触发自动化
- 记录更新触发带字段过滤自动化
- 条件命中 then 分支
- 条件不命中 else 分支
- 手动触发 run

### 手工验证

- 创建“记录创建 -> 添加评论”
- 创建“字段值变化 -> 更新另一字段”
- 创建“定时触发 -> Webhook”
- 查看执行日志和每步结果

## 分阶段实施建议

实现顺序：

1. Prisma 模型 + types + validators
2. 自动化 CRUD API
3. 运行记录模型和执行器骨架
4. 数据事件触发入口
5. 手动触发入口
6. 定时触发入口
7. 列表页
8. 画布编辑页
9. 日志页

## 验收标准

本期视为完成的标准：

- 可创建“记录创建时 -> 调用 Webhook / 添加评论”的自动化
- 可创建“字段值变化 -> 更新另一字段”的自动化
- 条件分支正确执行
- 可手动触发自动化
- 定时触发可生成 run
- 执行日志可查看 run 和 step 结果

## 风险与后续

主要风险：

- 画布编辑器复杂度可能挤占运行时实现时间
- Webhook 动作会引入外部依赖和超时问题
- 如果条件系统不与现有 filter 语义对齐，后续维护成本会升高

后续扩展方向：

- 邮件通知
- 重试与补跑
- 失败通知
- 并行节点
- 更丰富的上下文变量和模板表达式
