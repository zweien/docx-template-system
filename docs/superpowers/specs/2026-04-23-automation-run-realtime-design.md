# Issue #138 自动化运行实时反馈设计

## 背景

`#118` 已经交付自动化定义、运行队列、运行日志和手动触发入口，`#137` 补齐了“更新关联记录”动作能力。当前自动化详情页仍然是静态查看模式：

- 手动触发调用 `/api/automations/[id]/run` 后，只返回 `runId`
- 前端通过 `router.refresh()` 被动刷新页面
- 运行日志列表在页面首次渲染后不再自动更新
- 用户无法实时看到 `PENDING -> RUNNING -> SUCCEEDED | FAILED` 的状态变化

这会直接导致两个体验问题：

1. 用户点击“手动运行”后，页面反馈弱，容易误判为没有生效
2. 自动化运行完成或失败后，用户必须手动刷新才能看到结果

`#138` 的目标是为“自动化详情页”补上最小闭环的实时反馈链路，而不是建设全站通知中心。

## 范围

本期必须支持：

- 自动化详情页建立实时订阅链路
- 手动触发后，页面立即给出运行已创建反馈
- 最新运行状态在详情页内自动更新
- 最新运行记录自动插入日志列表顶部
- 运行成功和失败给出即时前端提示
- 已展开的运行详情在步骤变化后能自动刷新

本期明确不做：

- 全站通知中心联动
- 自动化结果写入 `Notification` 并驱动未读数变化
- 邮件、IM、Webhook 之外的外部推送
- 跨页面、跨模块的全局自动化状态广播
- 自动化列表页实时刷新

## 设计原则

- 只解决自动化详情页当前缺口，不顺手扩成通用通知系统
- 实时链路复用现有数据表 SSE 的技术路线，避免引入第二种前后端协议
- 运行状态变更必须以服务端状态为准，前端只做增量合并，不自行推测最终结果
- 前端实时联动必须容忍 SSE 中断，断链后仍可通过手动刷新恢复

## 方案对比

### 方案 A：前端短轮询

做法：

- 手动触发后启动 `setInterval`
- 周期请求 `/api/automations/[id]/runs`
- 直到最新 run 进入终态停止轮询

优点：

- 实现简单
- 后端几乎不用改

缺点：

- 不是真实时
- 轮询会重复拉取整个列表
- 很难优雅支持“已展开 run 详情增量刷新”
- 只能覆盖“手动触发后”的场景，无法自然覆盖事件触发或定时触发带来的新运行

结论：

- 可作为兜底思路，不作为本期主方案

### 方案 B：自动化专用 SSE

做法：

- 新增自动化详情页专用 SSE 路由 `/api/automations/[id]/realtime`
- 自动化运行状态变化时发布事件
- 前端使用 `EventSource` 订阅并增量更新运行列表

优点：

- 与现有数据表 realtime 技术栈一致
- 实时性好
- 事件语义清晰，适配运行创建、状态更新、步骤更新
- 能自然覆盖手动触发、事件触发、定时触发三种来源

缺点：

- 需要新增自动化实时事件模型和订阅路由
- 需要在运行服务里补发布逻辑

结论：

- 这是本期推荐方案

### 方案 C：复用站内通知中心

做法：

- 自动化完成或失败时写入 `Notification`
- 前端通过通知中心展示结果

优点：

- 复用已有通知持久化模型

缺点：

- 通知适合“消息”，不适合表达连续状态流
- 不能自然表达 `PENDING -> RUNNING -> SUCCEEDED`
- 会把本期范围扩大到通知中心交互设计

结论：

- 不采用

## 最终方案

采用方案 B：自动化专用 SSE + 自动化详情页增量更新。

整体路径如下：

1. 用户打开自动化详情页
2. 前端对当前 `automationId` 建立 SSE 连接
3. 手动触发时，接口立即返回 `runId`
4. 后端创建 `AutomationRun`、开始执行、步骤更新、结束执行时发布实时事件
5. 前端订阅到事件后更新运行列表和提示状态
6. 若当前展开的运行详情受影响，则重新拉取该 run 的详情

## 架构设计

系统增加三个部分：

1. 自动化实时事件类型
2. 自动化 SSE 订阅 API
3. 自动化详情页实时 Hook

沿用现有数据表 realtime 的模式：

- 后端仍基于 `ReadableStream + text/event-stream`
- 服务层继续以状态变更为中心
- 前端继续使用 `EventSource`

但自动化事件与数据表事件解耦，不混入 `src/types/realtime.ts` 当前的数据表事件模型里，避免不同业务域的事件 union 持续膨胀。

## 事件模型

新增文件：

- `src/types/automation-realtime.ts`

定义事件：

```ts
type AutomationRealtimeEvent =
  | {
      type: "automation_run_created";
      automationId: string;
      run: AutomationRunItem;
    }
  | {
      type: "automation_run_updated";
      automationId: string;
      run: AutomationRunItem;
    }
  | {
      type: "automation_run_step_updated";
      automationId: string;
      runId: string;
      stepId: string;
      status: AutomationRunStepStatus;
    };
```

说明：

- `automation_run_created`
  - 新 run 已落库，可直接插入列表顶部
- `automation_run_updated`
  - run 主状态变化，例如 `RUNNING`、`SUCCEEDED`、`FAILED`
  - 使用完整 `AutomationRunItem` 作为 payload，前端无需再做字段级拼装
- `automation_run_step_updated`
  - 只表达某个步骤状态发生变化
  - 前端收到后，如果该 run 正在展开详情，则重新请求 `/api/automations/runs/[runId]`

本期不额外设计“步骤完整对象”事件，原因：

- 运行详情面板当前本来就是按需拉取
- 只为单个展开 run 做 detail refetch 更简单
- 避免把步骤详情和主列表状态绑成一个更重的实时载荷

## 后端设计

### 1. 自动化实时发布服务

新增：

- `src/lib/services/automation-realtime.service.ts`

职责：

- 按 `automationId` 维护内存监听器集合
- 懒加载 PostgreSQL `LISTEN/NOTIFY`
- 发布和订阅自动化运行事件

为什么不直接复用 `src/lib/services/realtime-notify.service.ts`：

- 当前实现的 topic 语义是 `tableId`
- 当前事件模型严格绑定 `RealtimeEvent`
- 若直接硬改为“全局泛型 pub/sub”，会把本期范围扩到已有数据表实时链路重构

本期采取更稳妥的做法：

- 复制现有 realtime 实现模式
- 但独立为自动化域服务
- 等未来确实出现第三个实时业务域，再抽象共享底层

这符合 YAGNI，也能保证 `#138` 的交付风险最小。

### 2. SSE 路由

新增路由：

- `src/app/api/automations/[id]/realtime/route.ts`

行为：

- 校验登录态
- 校验自动化是否属于当前用户
- 建立 `EventSource` 连接
- 订阅当前 `automationId` 的实时事件
- 输出：
  - `connected`
  - `heartbeat`
  - `AutomationRealtimeEvent`

返回头保持与数据表 realtime 一致：

- `Content-Type: text/event-stream`
- `Cache-Control: no-cache, no-transform`
- `Connection: keep-alive`
- `X-Accel-Buffering: no`

### 3. 运行服务发布点

在以下服务方法中补事件发布：

- `createAutomationRun`
  - 发布 `automation_run_created`
- `markAutomationRunStarted`
  - 发布 `automation_run_updated`
- `markAutomationRunSucceeded`
  - 发布 `automation_run_updated`
- `markAutomationRunFailed`
  - 发布 `automation_run_updated`
- `markAutomationRunStepSucceeded`
  - 发布 `automation_run_step_updated`
- `markAutomationRunStepFailed`
  - 发布 `automation_run_step_updated`

这里有一个关键约束：

- 发布事件必须在数据库更新成功之后进行
- 事件 payload 需要包含更新后的 run 状态

因此，`markAutomationRunStarted / Succeeded / Failed` 需要在 update 后重新拿到最新 row，或直接让 Prisma `update` 返回必要字段，再映射为 `AutomationRunItem`。

### 4. 权限边界

自动化实时订阅只允许自动化创建者访问：

- 与现有 `getAutomation`、`listAutomationRuns` 的权限模型一致
- 不在本期扩展团队共享或管理员旁路查看

## 前端设计

### 1. 新增 Hook

新增：

- `src/hooks/use-automation-run-realtime.ts`

输入：

```ts
{
  automationId: string;
  enabled?: boolean;
  onRunCreated?: (run: AutomationRunItem) => void;
  onRunUpdated?: (run: AutomationRunItem) => void;
  onRunStepUpdated?: (event: { runId: string; stepId: string; status: AutomationRunStepStatus }) => void;
}
```

输出：

```ts
{
  isConnected: boolean;
}
```

职责：

- 建立和关闭 SSE
- 解析事件
- 向组件回调分发
- 暴露连接状态，便于页面展示“实时连接中 / 已断开”

### 2. 自动化详情页状态提升

当前 `AutomationDetailPage` 是服务端组件，直接把 `runItems` 传给 `AutomationRunLog`。

本期调整为：

- 保留服务端首屏拉取，保证 SEO 与首次渲染可用
- 新增一个客户端包装组件，例如：
  - `src/components/automations/automation-detail-live.tsx`

该组件负责：

- 接收服务端初始 `runItems`
- 在客户端维护 `runs` 状态
- 建立 `useAutomationRunRealtime`
- 将实时更新后的 `runs` 传给 `AutomationRunLog`
- 为 `AutomationRunActions` 提供 `onRunQueued` 之类的回调

这样可以避免直接把 `AutomationRunLog` 的实时状态管理继续堆大。

### 3. 手动触发交互

`AutomationRunActions` 改造目标：

- 手动触发成功后立即提示：
  - `已创建运行任务 <runId>`
- 使用 `toast.success` / `toast.error` 作为主反馈
- 保留页内文案作为次级反馈或改为单一 `toast`，二选一中推荐 `toast`
- 不再依赖 `router.refresh()` 作为主要状态刷新手段

具体行为：

- 调用 `/api/automations/[id]/run`
- 拿到 `runId`
- 立即调用 `onRunQueued(runId)`，给页面一个“本地已创建”的短反馈
- 真正的 run 列表插入以 SSE 的 `automation_run_created` 为准

为什么不在前端收到 `runId` 后直接乐观插入一条伪 run：

- 当前接口只返回 `runId`，不返回完整 run 对象
- 伪造一条 run 会带来时间、状态、triggerPayload 等字段不一致问题
- 让 SSE 作为唯一事实来源更稳妥

### 4. 运行日志列表联动

`AutomationRunLog` 需要支持两类变化：

#### 新运行插入

- 收到 `automation_run_created`
- 若列表中不存在该 `run.id`，插入顶部
- 若列表已有该 `run.id`，执行覆盖更新

#### 主状态更新

- 收到 `automation_run_updated`
- 按 `run.id` 替换对应项
- 若状态从非终态进入终态：
  - `SUCCEEDED` 显示成功提示
  - `FAILED` 显示失败提示

### 5. 已展开详情刷新

当前 `AutomationRunLog` 内部维护：

- `expandedRunId`
- `detailMap`

本期保持这个结构，不额外上提详情状态。

新增逻辑：

- 收到 `automation_run_step_updated`
- 如果 `expandedRunId === event.runId`
  - 清空该 `runId` 的 detail cache
  - 触发一次重新拉取详情

收到 `automation_run_updated` 时：

- 如果当前展开的 run 状态变化为 `FAILED` 或 `SUCCEEDED`
  - 同样触发一次详情重新拉取

这样可以保证：

- 列表是增量实时更新的
- 详情仍然走现有详情接口
- 不需要实时同步整个 step 列表

## UI 行为定义

### 连接状态

自动化详情页可选展示一个低优先级状态提示：

- 已连接：不显式提示，保持安静
- 已断开：展示一行弱提示，例如“实时连接已断开，状态可能不是最新”

本期不做自动重连 UI 控件，`EventSource` 的浏览器默认重连足够。

### 手动触发

- 点击后按钮进入 pending
- 接口成功：`toast.success("已创建运行任务")`
- 接口失败：`toast.error("触发自动化失败")`

### 运行完成提示

- `RUNNING -> SUCCEEDED`
  - `toast.success("自动化运行成功")`
- `RUNNING -> FAILED`
  - `toast.error(errorMessage ?? "自动化运行失败")`

为避免重复提示，客户端只对“当前页面会话期间首次观察到的状态跃迁”弹提示，不对首屏已有终态 run 补弹。

## 数据流

### 手动触发场景

```text
用户点击手动运行
  -> POST /api/automations/[id]/run
  -> createAutomationRun()
  -> publish automation_run_created
  -> enqueue queue job
  -> 前端 SSE 收到 created，插入日志列表
  -> markAutomationRunStarted()
  -> publish automation_run_updated(status=RUNNING)
  -> 执行动作步骤
  -> markAutomationRunStepSucceeded/Failed()
  -> publish automation_run_step_updated
  -> markAutomationRunSucceeded/Failed()
  -> publish automation_run_updated(status=SUCCEEDED|FAILED)
```

### 页面更新场景

```text
AutomationDetailLive
  -> useAutomationRunRealtime
  -> runs state updated
  -> AutomationRunLog re-render
  -> 若展开 run 被步骤事件命中，重新 fetch /api/automations/runs/[runId]
```

## 错误处理

### SSE 连接失败

- Hook 将 `isConnected` 设为 `false`
- 页面显示弱提示
- 用户仍可手动刷新页面恢复

### 事件解析失败

- 忽略单条异常事件
- 不中断整条连接

### 详情刷新失败

- 保留 `AutomationRunLog` 现有错误态
- 不影响主列表继续实时更新

### 服务端发布失败

- 不影响 run 落库和执行
- 只损失当前实时可见性
- 用户刷新页面后仍能看到最终结果

这意味着：实时事件是增强能力，不是运行正确性的依赖项。

## 测试策略

### 服务层测试

新增测试：

- `src/lib/services/automation-realtime.service.test.ts`
  - 订阅 / 发布 / 取消订阅
- `src/lib/services/automation-run.service.test.ts`
  - 创建 run 时发布 `automation_run_created`
  - run 状态更新时发布 `automation_run_updated`
  - step 状态更新时发布 `automation_run_step_updated`

### 路由测试

新增：

- `src/app/api/automations/[id]/realtime/route.test.ts`

覆盖：

- 未登录返回 `401`
- 非自动化所有者返回 `404`
- 建立 SSE 时写出 `connected`

### 前端测试

新增：

- `src/hooks/use-automation-run-realtime.test.ts`
  - 正确解析 `created / updated / step_updated`
- `src/components/automations/automation-run-actions.test.tsx`
  - 手动触发成功后提示成功
  - 手动触发失败后提示错误
- `src/components/automations/automation-run-log.test.tsx`
  - 收到 run created 时插入新记录
  - 收到 run updated 时更新 badge
  - 收到 step updated 且当前 run 已展开时，触发详情刷新

### 验证命令

```bash
pnpm vitest run "src/lib/services/automation-run.service.test.ts" "src/app/api/automations/[id]/realtime/route.test.ts" "src/components/automations"
pnpm eslint "src/components/automations" "src/hooks/use-automation-run-realtime.ts" "src/app/api/automations/[id]/realtime/route.ts" "src/lib/services/automation-realtime.service.ts" "src/lib/services/automation-run.service.ts"
npx tsc --noEmit
```

## 实施顺序

1. 定义自动化实时事件类型
2. 新增自动化 realtime service 与 SSE route
3. 在 automation-run service 中补发布点
4. 新增客户端实时 hook
5. 增加自动化详情页客户端包装组件
6. 改造 `AutomationRunActions`
7. 改造 `AutomationRunLog` 的实时增量更新能力
8. 补齐测试并跑通 lint / typecheck

## 风险与取舍

### 风险 1：重复发布或重复提示

原因：

- SSE 重连后，客户端可能重新收到后续状态事件

控制方式：

- 运行列表按 `run.id` 覆盖更新，不按数组 append
- 提示逻辑基于“前一个状态 -> 新状态”的跃迁判断

### 风险 2：详情刷新过于频繁

原因：

- 每次步骤事件都可能触发详情请求

控制方式：

- 只对当前展开的 `runId` 刷新详情
- 本期动作链是串行执行，步骤频率有限，可接受

### 风险 3：新增第二套 realtime service

原因：

- 自动化和数据表各有一个 realtime 服务

取舍：

- 当前两个业务域的 topic 和 payload 差异足够大
- 立即抽象底层泛型 pub/sub 会扩大改动面
- 先独立实现，后续若再出现第三类实时业务，再统一抽象

## 验收标准

- 手动触发后，前端能实时看到状态从 `PENDING/RUNNING` 变为 `SUCCEEDED/FAILED`
- 自动化详情页无需手动刷新即可看到新运行记录
- 失败场景下用户能收到即时反馈
- SSE 断开不影响运行正确性，刷新页面后仍能看到真实状态
