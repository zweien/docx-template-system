# Automation Run Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为自动化详情页增加 SSE 实时反馈链路，让手动触发后的运行列表、状态变化和展开详情无需手动刷新即可更新。

**Architecture:** 新增自动化域专用实时事件类型和 `automation-realtime.service`，通过 `/api/automations/[id]/realtime` 向详情页推送 `run created / run updated / step updated` 事件。前端通过 `useAutomationRunRealtime` 和一个客户端包装组件维护运行列表状态，`AutomationRunActions` 负责触发反馈，`AutomationRunLog` 负责增量更新与详情重载。

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, PostgreSQL `LISTEN/NOTIFY`, 原有 service-layer 模式, 原有 Base UI / shadcn 组件, `sonner`.

---

## File Structure

### New files

- `src/types/automation-realtime.ts`
  Purpose: 定义自动化详情页使用的 SSE 事件类型，不污染现有 `src/types/realtime.ts`。
- `src/lib/services/automation-realtime.service.ts`
  Purpose: 提供按 `automationId` 订阅和发布实时事件的服务，内部维护独立 `LISTEN/NOTIFY` 通道。
- `src/app/api/automations/[id]/realtime/route.ts`
  Purpose: SSE 订阅入口，校验权限并输出 `connected`、`heartbeat` 与自动化实时事件。
- `src/hooks/use-automation-run-realtime.ts`
  Purpose: 客户端封装 `EventSource`，向页面分发运行创建、状态更新、步骤更新事件。
- `src/components/automations/automation-detail-live.tsx`
  Purpose: 在详情页中维护客户端运行状态，将 SSE 更新和手动触发反馈接到 `AutomationRunActions` 与 `AutomationRunLog`。
- `src/app/api/automations/[id]/realtime/route.test.ts`
  Purpose: 路由权限和 SSE 初始输出测试。
- `src/hooks/use-automation-run-realtime.test.ts`
  Purpose: Hook 事件解析与连接状态测试。
- `src/components/automations/automation-run-actions.test.tsx`
  Purpose: 手动触发成功、失败和回调行为测试。

### Modified files

- `src/lib/services/automation-run.service.ts`
  Purpose: 在创建 run、run 状态变化、step 状态变化时发布自动化实时事件。
- `src/lib/services/automation-run.service.test.ts`
  Purpose: 验证 run / step 更新时的事件发布。
- `src/app/(dashboard)/automations/[id]/page.tsx`
  Purpose: 用客户端包装组件替换直接渲染 `AutomationRunActions` 与 `AutomationRunLog` 的方式。
- `src/components/automations/automation-run-actions.tsx`
  Purpose: 去掉 `router.refresh()` 依赖，增加 `onRunQueued` 回调和 `toast` 反馈。
- `src/components/automations/automation-run-log.tsx`
  Purpose: 支持外部注入实时 run 列表、展开详情重载和终态提示协作。
- `src/components/automations/automation-run-log.test.tsx`
  Purpose: 覆盖 run 增量更新、详情刷新和现有展开行为。

---

### Task 1: 定义自动化实时事件类型与发布服务

**Files:**
- Create: `src/types/automation-realtime.ts`
- Create: `src/lib/services/automation-realtime.service.ts`
- Test: `src/lib/services/automation-realtime.service.test.ts`

- [ ] **Step 1: 写失败测试，固定自动化域的订阅 / 发布语义**

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const { poolQueryMock } = vi.hoisted(() => ({
  poolQueryMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  pool: {
    query: poolQueryMock,
  },
}));

describe("automation-realtime.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes an automation run update event through pg_notify", async () => {
    const { publishAutomationRealtimeEvent } = await import("./automation-realtime.service");

    await publishAutomationRealtimeEvent({
      type: "automation_run_updated",
      automationId: "aut-1",
      run: {
        id: "run-1",
        automationId: "aut-1",
        status: "RUNNING",
        triggerSource: "MANUAL",
        triggerPayload: {},
        contextSnapshot: {},
        startedAt: "2026-04-23T00:00:00.000Z",
        finishedAt: null,
        durationMs: null,
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-04-23T00:00:00.000Z",
      },
    });

    expect(poolQueryMock).toHaveBeenCalledWith(expect.stringContaining("pg_notify"), [
      "automation_run_events",
      expect.stringContaining("\"automationId\":\"aut-1\""),
    ]);
  });

  it("subscribes and unsubscribes listeners by automationId", async () => {
    const {
      subscribeToAutomation,
      broadcastToAutomation,
    } = await import("./automation-realtime.service");

    const listener = vi.fn();
    const unsubscribe = subscribeToAutomation("aut-1", listener);

    broadcastToAutomation("aut-1", {
      type: "automation_run_created",
      automationId: "aut-1",
      run: {
        id: "run-1",
        automationId: "aut-1",
        status: "PENDING",
        triggerSource: "MANUAL",
        triggerPayload: {},
        contextSnapshot: {},
        startedAt: null,
        finishedAt: null,
        durationMs: null,
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-04-23T00:00:00.000Z",
      },
    });

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    broadcastToAutomation("aut-1", {
      type: "automation_run_step_updated",
      automationId: "aut-1",
      runId: "run-1",
      stepId: "step-1",
      status: "SUCCEEDED",
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 运行测试，确认先红**

Run: `pnpm vitest run "src/lib/services/automation-realtime.service.test.ts"`
Expected: FAIL，报错缺少 `automation-realtime.service.ts` 或缺少目标导出。

- [ ] **Step 3: 添加自动化实时事件类型**

```ts
import type { AutomationRunItem, AutomationRunStepStatus } from "@/types/automation";

export type AutomationRealtimeConnectedEvent = {
  type: "connected";
  automationId: string;
};

export type AutomationRealtimeHeartbeatEvent = {
  type: "heartbeat";
  ts: number;
};

export type AutomationRunCreatedEvent = {
  type: "automation_run_created";
  automationId: string;
  run: AutomationRunItem;
};

export type AutomationRunUpdatedEvent = {
  type: "automation_run_updated";
  automationId: string;
  run: AutomationRunItem;
};

export type AutomationRunStepUpdatedEvent = {
  type: "automation_run_step_updated";
  automationId: string;
  runId: string;
  stepId: string;
  status: AutomationRunStepStatus;
};

export type AutomationRealtimeEvent =
  | AutomationRunCreatedEvent
  | AutomationRunUpdatedEvent
  | AutomationRunStepUpdatedEvent;

export type AutomationRealtimeStreamEvent =
  | AutomationRealtimeConnectedEvent
  | AutomationRealtimeHeartbeatEvent
  | AutomationRealtimeEvent;
```

- [ ] **Step 4: 以现有数据表 realtime 的模式实现自动化发布服务**

```ts
import { Client } from "pg";
import { pool } from "@/lib/db";
import type { AutomationRealtimeEvent } from "@/types/automation-realtime";

type AutomationRealtimeListener = (event: AutomationRealtimeEvent) => void;

const CHANNEL = "automation_run_events";
const listeners = new Map<string, Set<AutomationRealtimeListener>>();
let listenClient: Client | null = null;
let initPromise: Promise<void> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleReconnect(): void {
  if (reconnectTimer || listeners.size === 0) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void ensureListening();
  }, 3000);
}

async function ensureListening(): Promise<void> {
  if (listenClient) {
    return;
  }

  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);

    client.on("notification", (msg) => {
      if (!msg.payload) {
        return;
      }

      try {
        const event = JSON.parse(msg.payload) as AutomationRealtimeEvent;
        const scopedListeners = listeners.get(event.automationId);
        if (!scopedListeners) {
          return;
        }

        for (const listener of scopedListeners) {
          listener(event);
        }
      } catch {
        // ignore malformed events
      }
    });

    client.on("error", () => {
      listenClient = null;
      initPromise = null;
      scheduleReconnect();
    });

    client.on("end", () => {
      listenClient = null;
      initPromise = null;
      scheduleReconnect();
    });

    listenClient = client;
  })();

  await initPromise;
}

export async function publishAutomationRealtimeEvent(
  event: AutomationRealtimeEvent
): Promise<void> {
  await pool.query(`SELECT pg_notify($1, $2)`, [CHANNEL, JSON.stringify(event)]);
}

export function subscribeToAutomation(
  automationId: string,
  listener: AutomationRealtimeListener
): () => void {
  if (!listeners.has(automationId)) {
    listeners.set(automationId, new Set());
  }

  listeners.get(automationId)!.add(listener);
  void ensureListening();

  return () => {
    const scopedListeners = listeners.get(automationId);
    if (!scopedListeners) {
      return;
    }

    scopedListeners.delete(listener);
    if (scopedListeners.size === 0) {
      listeners.delete(automationId);
    }
  };
}

export function broadcastToAutomation(
  automationId: string,
  event: AutomationRealtimeEvent
): void {
  const scopedListeners = listeners.get(automationId);
  if (!scopedListeners) {
    return;
  }

  for (const listener of scopedListeners) {
    listener(event);
  }
}

export function shutdownAutomationRealtime(): void {
  if (listenClient) {
    void listenClient.end();
    listenClient = null;
    initPromise = null;
  }

  listeners.clear();
}
```

- [ ] **Step 5: 回跑测试，确认转绿**

Run: `pnpm vitest run "src/lib/services/automation-realtime.service.test.ts"`
Expected: PASS，2 个测试通过。

- [ ] **Step 6: 提交本任务**

```bash
git add "src/types/automation-realtime.ts" \
  "src/lib/services/automation-realtime.service.ts" \
  "src/lib/services/automation-realtime.service.test.ts"
git commit -m "feat(automation): add realtime event service"
```

---

### Task 2: 在运行服务中发布事件，并提供 SSE 路由

**Files:**
- Modify: `src/lib/services/automation-run.service.ts`
- Modify: `src/lib/services/automation-run.service.test.ts`
- Create: `src/app/api/automations/[id]/realtime/route.ts`
- Create: `src/app/api/automations/[id]/realtime/route.test.ts`

- [ ] **Step 1: 先写运行服务失败测试，锁定发布点**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAutomationRun,
  markAutomationRunStarted,
  markAutomationRunStepFailed,
} from "@/lib/services/automation-run.service";

const { publishAutomationRealtimeEventMock } = vi.hoisted(() => ({
  publishAutomationRealtimeEventMock: vi.fn(),
}));

vi.mock("@/lib/services/automation-realtime.service", () => ({
  publishAutomationRealtimeEvent: publishAutomationRealtimeEventMock,
}));

describe("automation-run realtime publishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes run created after persisting a pending run", async () => {
    const result = await createAutomationRun({
      automationId: "aut-1",
      triggerSource: "MANUAL",
      triggerPayload: {},
      contextSnapshot: {
        tableId: "tbl-1",
        record: null,
        previousRecord: null,
        changedFields: [],
        triggeredAt: "2026-04-23T00:00:00.000Z",
        actor: { id: "user-1" },
      },
    });

    expect(result.success).toBe(true);
    expect(publishAutomationRealtimeEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "automation_run_created",
        automationId: "aut-1",
      })
    );
  });

  it("publishes step updated after marking a step failed", async () => {
    await markAutomationRunStepFailed("step-1", {
      code: "ACTION_EXECUTION_FAILED",
      message: "Webhook returned 500",
    });

    expect(publishAutomationRealtimeEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "automation_run_step_updated",
        stepId: "step-1",
        status: "FAILED",
      })
    );
  });
});
```

- [ ] **Step 2: 运行测试，确认先红**

Run: `pnpm vitest run "src/lib/services/automation-run.service.test.ts"`
Expected: FAIL，提示未调用 `publishAutomationRealtimeEvent`。

- [ ] **Step 3: 修改运行服务，让关键状态更新直接返回最新 row 并发布事件**

```ts
import { publishAutomationRealtimeEvent } from "@/lib/services/automation-realtime.service";

async function emitRunUpdatedEvent(row: {
  id: string;
  automationId: string;
  status: string;
  triggerSource: string;
  triggerPayload: unknown;
  contextSnapshot: unknown;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
}) {
  await publishAutomationRealtimeEvent({
    type: "automation_run_updated",
    automationId: row.automationId,
    run: mapAutomationRunItem(row),
  });
}

export async function createAutomationRun(
  input: EnqueueAutomationRunInput
): Promise<ServiceResult<{ id: string }>> {
  try {
    const created = await db.automationRun.create({
      data: {
        automationId: input.automationId,
        status: "PENDING",
        triggerSource: input.triggerSource,
        triggerPayload: toJsonValue(input.triggerPayload),
        contextSnapshot: toJsonValue(input.contextSnapshot),
      },
      select: {
        id: true,
        automationId: true,
        status: true,
        triggerSource: true,
        triggerPayload: true,
        contextSnapshot: true,
        startedAt: true,
        finishedAt: true,
        durationMs: true,
        errorCode: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    await publishAutomationRealtimeEvent({
      type: "automation_run_created",
      automationId: created.automationId,
      run: mapAutomationRunItem(created),
    });

    return { success: true, data: { id: created.id } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建自动化运行记录失败";
    return { success: false, error: { code: "CREATE_RUN_FAILED", message } };
  }
}

export async function markAutomationRunStarted(runId: string): Promise<ServiceResult<null>> {
  try {
    const updated = await db.automationRun.update({
      where: { id: runId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
      },
      select: {
        id: true,
        automationId: true,
        status: true,
        triggerSource: true,
        triggerPayload: true,
        contextSnapshot: true,
        startedAt: true,
        finishedAt: true,
        durationMs: true,
        errorCode: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    await emitRunUpdatedEvent(updated);
    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "标记自动化运行开始失败";
    return { success: false, error: { code: "MARK_RUN_STARTED_FAILED", message } };
  }
}

export async function markAutomationRunStepFailed(
  stepId: string,
  error: { code?: string; message: string }
): Promise<ServiceResult<null>> {
  try {
    const updated = await db.automationRunStep.update({
      where: { id: stepId },
      data: {
        status: "FAILED",
        errorCode: error.code ?? "STEP_FAILED",
        errorMessage: error.message,
        finishedAt: new Date(),
      },
      select: {
        id: true,
        runId: true,
        status: true,
        run: {
          select: {
            automationId: true,
          },
        },
      },
    });

    await publishAutomationRealtimeEvent({
      type: "automation_run_step_updated",
      automationId: updated.run.automationId,
      runId: updated.runId,
      stepId: updated.id,
      status: updated.status as "FAILED",
    });

    return { success: true, data: null };
  } catch (updateError) {
    const message =
      updateError instanceof Error ? updateError.message : "标记自动化步骤失败失败";
    return { success: false, error: { code: "MARK_RUN_STEP_FAILED_FAILED", message } };
  }
}
```

- [ ] **Step 4: 先写 SSE 路由失败测试**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getAutomationMock = vi.fn();
const subscribeToAutomationMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/automation.service", () => ({
  getAutomation: getAutomationMock,
}));

vi.mock("@/lib/services/automation-realtime.service", () => ({
  subscribeToAutomation: subscribeToAutomationMock,
}));

describe("api/automations/[id]/realtime route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET({ signal: new AbortController().signal } as never, {
      params: Promise.resolve({ id: "aut-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("streams a connected event for an owned automation", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getAutomationMock.mockResolvedValue({
      success: true,
      data: { id: "aut-1", name: "同步作者信息" },
    });
    subscribeToAutomationMock.mockReturnValue(() => undefined);
    const { GET } = await import("./route");
    const controller = new AbortController();

    const response = await GET({ signal: controller.signal } as never, {
      params: Promise.resolve({ id: "aut-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
  });
});
```

- [ ] **Step 5: 运行路由测试，确认先红**

Run: `pnpm vitest run "src/app/api/automations/[id]/realtime/route.test.ts"`
Expected: FAIL，报错缺少 SSE 路由文件。

- [ ] **Step 6: 实现 SSE 路由**

```ts
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getAutomation } from "@/lib/services/automation.service";
import { subscribeToAutomation } from "@/lib/services/automation-realtime.service";
import type { AutomationRealtimeEvent } from "@/types/automation-realtime";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: automationId } = await params;
  const automation = await getAutomation(automationId, session.user.id);
  if (!automation.success) {
    return new Response("Not Found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "connected", automationId })}\n\n`
        )
      );

      const unsubscribe = subscribeToAutomation(
        automationId,
        (event: AutomationRealtimeEvent) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            // stream already closed
          }
        }
      );

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "heartbeat", ts: Date.now() })}\n\n`)
          );
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      request.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

- [ ] **Step 7: 回跑测试，确认转绿**

Run:
- `pnpm vitest run "src/lib/services/automation-run.service.test.ts"`
- `pnpm vitest run "src/app/api/automations/[id]/realtime/route.test.ts"`

Expected: PASS，服务测试和路由测试都通过。

- [ ] **Step 8: 提交本任务**

```bash
git add "src/lib/services/automation-run.service.ts" \
  "src/lib/services/automation-run.service.test.ts" \
  "src/app/api/automations/[id]/realtime/route.ts" \
  "src/app/api/automations/[id]/realtime/route.test.ts"
git commit -m "feat(automation): stream run status updates"
```

---

### Task 3: 增加客户端实时 Hook 和详情页状态容器

**Files:**
- Create: `src/hooks/use-automation-run-realtime.ts`
- Create: `src/hooks/use-automation-run-realtime.test.ts`
- Create: `src/components/automations/automation-detail-live.tsx`
- Modify: `src/app/(dashboard)/automations/[id]/page.tsx`

- [ ] **Step 1: 先写 Hook 失败测试**

```ts
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAutomationRunRealtime } from "./use-automation-run-realtime";

class MockEventSource {
  static instances: MockEventSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }
}

describe("useAutomationRunRealtime", () => {
  it("creates an EventSource and forwards run update events", () => {
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
    const onRunUpdated = vi.fn();

    renderHook(() =>
      useAutomationRunRealtime({
        automationId: "aut-1",
        onRunUpdated,
      })
    );

    const instance = MockEventSource.instances[0];
    instance.onmessage?.(
      new MessageEvent("message", {
        data: JSON.stringify({
          type: "automation_run_updated",
          automationId: "aut-1",
          run: {
            id: "run-1",
            automationId: "aut-1",
            status: "RUNNING",
            triggerSource: "MANUAL",
            triggerPayload: {},
            contextSnapshot: {},
            startedAt: "2026-04-23T00:00:00.000Z",
            finishedAt: null,
            durationMs: null,
            errorCode: null,
            errorMessage: null,
            createdAt: "2026-04-23T00:00:00.000Z",
          },
        }),
      })
    );

    expect(onRunUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ id: "run-1", status: "RUNNING" })
    );
  });
});
```

- [ ] **Step 2: 运行测试，确认先红**

Run: `pnpm vitest run "src/hooks/use-automation-run-realtime.test.ts"`
Expected: FAIL，缺少 Hook 文件或导出。

- [ ] **Step 3: 实现 Hook**

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AutomationRealtimeEvent,
  AutomationRealtimeStreamEvent,
} from "@/types/automation-realtime";
import type { AutomationRunItem, AutomationRunStepStatus } from "@/types/automation";

interface UseAutomationRunRealtimeOptions {
  automationId: string;
  enabled?: boolean;
  onRunCreated?: (run: AutomationRunItem) => void;
  onRunUpdated?: (run: AutomationRunItem) => void;
  onRunStepUpdated?: (event: {
    runId: string;
    stepId: string;
    status: AutomationRunStepStatus;
  }) => void;
}

export function useAutomationRunRealtime({
  automationId,
  enabled = true,
  onRunCreated,
  onRunUpdated,
  onRunStepUpdated,
}: UseAutomationRunRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const callbacksRef = useRef({ onRunCreated, onRunUpdated, onRunStepUpdated });

  useEffect(() => {
    callbacksRef.current = { onRunCreated, onRunUpdated, onRunStepUpdated };
  }, [onRunCreated, onRunUpdated, onRunStepUpdated]);

  useEffect(() => {
    if (!enabled || !automationId) {
      return;
    }

    const eventSource = new EventSource(`/api/automations/${automationId}/realtime`);

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as AutomationRealtimeStreamEvent;
        if (payload.type === "connected" || payload.type === "heartbeat") {
          return;
        }

        const realtimeEvent = payload as AutomationRealtimeEvent;
        if (realtimeEvent.type === "automation_run_created") {
          callbacksRef.current.onRunCreated?.(realtimeEvent.run);
          return;
        }

        if (realtimeEvent.type === "automation_run_updated") {
          callbacksRef.current.onRunUpdated?.(realtimeEvent.run);
          return;
        }

        callbacksRef.current.onRunStepUpdated?.({
          runId: realtimeEvent.runId,
          stepId: realtimeEvent.stepId,
          status: realtimeEvent.status,
        });
      } catch {
        // ignore malformed events
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [automationId, enabled]);

  return { isConnected };
}
```

- [ ] **Step 4: 新增详情页客户端状态容器**

```tsx
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AutomationRunActions } from "@/components/automations/automation-run-actions";
import { AutomationRunLog } from "@/components/automations/automation-run-log";
import { useAutomationRunRealtime } from "@/hooks/use-automation-run-realtime";
import type { AutomationRunItem, AutomationRunStepStatus } from "@/types/automation";

type AutomationDetailLiveProps = {
  automationId: string;
  initialRuns: AutomationRunItem[];
};

function upsertRun(items: AutomationRunItem[], nextRun: AutomationRunItem): AutomationRunItem[] {
  const existingIndex = items.findIndex((item) => item.id === nextRun.id);
  if (existingIndex === -1) {
    return [nextRun, ...items].slice(0, 10);
  }

  const nextItems = [...items];
  nextItems[existingIndex] = nextRun;
  return nextItems;
}

export function AutomationDetailLive({
  automationId,
  initialRuns,
}: AutomationDetailLiveProps) {
  const [runs, setRuns] = useState(initialRuns);
  const seenTerminalRef = useRef(new Set<string>());

  const handleRunUpdated = useCallback((run: AutomationRunItem) => {
    setRuns((current) => upsertRun(current, run));

    const isTerminal = run.status === "SUCCEEDED" || run.status === "FAILED";
    if (!isTerminal || seenTerminalRef.current.has(run.id)) {
      return;
    }

    seenTerminalRef.current.add(run.id);
    if (run.status === "SUCCEEDED") {
      toast.success("自动化运行成功");
    } else {
      toast.error(run.errorMessage ?? "自动化运行失败");
    }
  }, []);

  const realtime = useAutomationRunRealtime({
    automationId,
    onRunCreated: (run) => setRuns((current) => upsertRun(current, run)),
    onRunUpdated: handleRunUpdated,
    onRunStepUpdated: (_event: { runId: string; stepId: string; status: AutomationRunStepStatus }) => {
      // AutomationRunLog receives the latest runs and handles detail refetch internally.
    },
  });

  const helperText = useMemo(
    () =>
      realtime.isConnected ? undefined : "实时连接已断开，状态可能不是最新，请稍后刷新页面。",
    [realtime.isConnected]
  );

  return (
    <div className="space-y-4">
      <AutomationRunActions automationId={automationId} />
      <AutomationRunLog items={runs} helperText={helperText} />
    </div>
  );
}
```

- [ ] **Step 5: 用状态容器替换详情页直连结构**

```tsx
import { AutomationDetailLive } from "@/components/automations/automation-detail-live";

// ...
<div className="mt-4">
  <AutomationDetailLive
    automationId={result.data.id}
    initialRuns={runItems}
  />
</div>

// remove the standalone AutomationRunActions / AutomationRunLog rendering below
```

- [ ] **Step 6: 回跑测试，确认 Hook 转绿**

Run: `pnpm vitest run "src/hooks/use-automation-run-realtime.test.ts"`
Expected: PASS，Hook 能正确分发事件。

- [ ] **Step 7: 提交本任务**

```bash
git add "src/hooks/use-automation-run-realtime.ts" \
  "src/hooks/use-automation-run-realtime.test.ts" \
  "src/components/automations/automation-detail-live.tsx" \
  "src/app/(dashboard)/automations/[id]/page.tsx"
git commit -m "feat(automation): add live run detail state"
```

---

### Task 4: 改造触发按钮和运行日志，使其支持实时联动

**Files:**
- Modify: `src/components/automations/automation-run-actions.tsx`
- Create: `src/components/automations/automation-run-actions.test.tsx`
- Modify: `src/components/automations/automation-run-log.tsx`
- Modify: `src/components/automations/automation-run-log.test.tsx`

- [ ] **Step 1: 先写触发按钮失败测试**

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AutomationRunActions } from "./automation-run-actions";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AutomationRunActions", () => {
  it("calls onRunQueued after a successful manual run", async () => {
    const onRunQueued = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { runId: "run-1" },
        }),
      })
    );

    render(<AutomationRunActions automationId="aut-1" onRunQueued={onRunQueued} />);
    fireEvent.click(screen.getByRole("button", { name: "手动运行" }));

    await waitFor(() => {
      expect(onRunQueued).toHaveBeenCalledWith("run-1");
    });
  });
});
```

- [ ] **Step 2: 运行测试，确认先红**

Run: `pnpm vitest run "src/components/automations/automation-run-actions.test.tsx"`
Expected: FAIL，组件还没有 `onRunQueued` props。

- [ ] **Step 3: 改造触发按钮组件**

```tsx
"use client";

import { useState } from "react";
import { Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type AutomationRunActionsProps = {
  automationId: string;
  onRunQueued?: (runId: string) => void;
};

export function AutomationRunActions({
  automationId,
  onRunQueued,
}: AutomationRunActionsProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/automations/${automationId}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as
        | { success: true; data: { runId: string } }
        | { error?: { message?: string } };

      if (!response.ok) {
        const message = "error" in payload ? payload.error?.message : undefined;
        setError(message ?? "触发自动化失败");
        toast.error(message ?? "触发自动化失败");
        return;
      }

      if ("success" in payload && payload.success) {
        onRunQueued?.(payload.data.runId);
        toast.success(`已创建运行任务 ${payload.data.runId}`);
      }
    } catch {
      setError("触发自动化失败");
      toast.error("触发自动化失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={handleRun} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
        手动运行
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 4: 先写运行日志失败测试，锁定详情重拉与辅助文案**

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AutomationRunLog } from "./automation-run-log";

describe("AutomationRunLog realtime helpers", () => {
  it("shows helper text and reloads detail when reloadToken changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          run: {
            id: "run-1",
            automationId: "aut-1",
            status: "RUNNING",
            triggerSource: "MANUAL",
            triggerPayload: {},
            contextSnapshot: {},
            startedAt: "2026-04-23T00:00:00.000Z",
            finishedAt: null,
            durationMs: null,
            errorCode: null,
            errorMessage: null,
            createdAt: "2026-04-23T00:00:00.000Z",
          },
          steps: [],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <AutomationRunLog
        items={[
          {
            id: "run-1",
            automationId: "aut-1",
            status: "RUNNING",
            triggerSource: "MANUAL",
            triggerPayload: {},
            contextSnapshot: {},
            startedAt: "2026-04-23T00:00:00.000Z",
            finishedAt: null,
            durationMs: null,
            errorCode: null,
            errorMessage: null,
            createdAt: "2026-04-23T00:00:00.000Z",
          },
        ]}
        helperText="实时连接已断开"
        detailReloadToken={0}
      />
    );

    expect(screen.getByText("实时连接已断开")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "详情" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    rerender(
      <AutomationRunLog
        items={[
          {
            id: "run-1",
            automationId: "aut-1",
            status: "RUNNING",
            triggerSource: "MANUAL",
            triggerPayload: {},
            contextSnapshot: {},
            startedAt: "2026-04-23T00:00:00.000Z",
            finishedAt: null,
            durationMs: null,
            errorCode: null,
            errorMessage: null,
            createdAt: "2026-04-23T00:00:00.000Z",
          },
        ]}
        helperText="实时连接已断开"
        detailReloadToken={1}
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
```

- [ ] **Step 5: 运行测试，确认先红**

Run: `pnpm vitest run "src/components/automations/automation-run-log.test.tsx" "src/components/automations/automation-run-actions.test.tsx"`
Expected: FAIL，`AutomationRunLog` 还没有 `helperText` 和 `detailReloadToken`。

- [ ] **Step 6: 改造运行日志组件，支持辅助文案与详情重拉 token**

```tsx
type AutomationRunLogProps = {
  items: AutomationRunItem[];
  helperText?: string;
  detailReloadToken?: number;
};

export function AutomationRunLog({
  items,
  helperText,
  detailReloadToken = 0,
}: AutomationRunLogProps) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, AutomationRunDetail | undefined>>({});
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null);
  const [errorMap, setErrorMap] = useState<Record<string, string | undefined>>({});

  const loadRunDetail = useCallback(async (runId: string, force = false) => {
    if (!force && (detailMap[runId] || loadingRunId === runId)) {
      return;
    }

    setLoadingRunId(runId);
    setErrorMap((prev) => ({ ...prev, [runId]: undefined }));

    try {
      const response = await fetch(`/api/automations/runs/${runId}`);
      const payload = (await response.json()) as
        | { success: true; data: AutomationRunDetail }
        | { error?: { message?: string } };

      if (!response.ok) {
        const message = "error" in payload ? payload.error?.message : undefined;
        setErrorMap((prev) => ({ ...prev, [runId]: message ?? "获取运行详情失败" }));
        return;
      }

      if ("success" in payload && payload.success) {
        setDetailMap((prev) => ({ ...prev, [runId]: payload.data }));
      }
    } catch {
      setErrorMap((prev) => ({ ...prev, [runId]: "获取运行详情失败" }));
    } finally {
      setLoadingRunId(null);
    }
  }, [detailMap, loadingRunId]);

  useEffect(() => {
    if (!expandedRunId) {
      return;
    }

    void loadRunDetail(expandedRunId, true);
  }, [detailReloadToken, expandedRunId, loadRunDetail]);

  async function handleToggle(runId: string) {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }

    setExpandedRunId(runId);
    await loadRunDetail(runId);
  }

  return (
    <Card className="bg-card/90">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-[520]">最近运行</CardTitle>
      </CardHeader>
      <CardContent>
        {helperText ? (
          <p className="mb-3 text-xs text-muted-foreground">{helperText}</p>
        ) : null}
        {/* keep existing list rendering */}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 7: 回跑组件测试，确认转绿**

Run:
- `pnpm vitest run "src/components/automations/automation-run-actions.test.tsx"`
- `pnpm vitest run "src/components/automations/automation-run-log.test.tsx"`

Expected: PASS，按钮与日志组件都通过。

- [ ] **Step 8: 提交本任务**

```bash
git add "src/components/automations/automation-run-actions.tsx" \
  "src/components/automations/automation-run-actions.test.tsx" \
  "src/components/automations/automation-run-log.tsx" \
  "src/components/automations/automation-run-log.test.tsx"
git commit -m "feat(automation): update run UI for realtime feedback"
```

---

### Task 5: 将实时步骤事件接到详情页，并完成回归验证

**Files:**
- Modify: `src/components/automations/automation-detail-live.tsx`
- Modify: `src/components/automations/automation-run-log.test.tsx`
- Verify: `src/lib/services/automation-run.service.test.ts`
- Verify: `src/app/api/automations/[id]/realtime/route.test.ts`
- Verify: `src/hooks/use-automation-run-realtime.test.ts`
- Verify: `src/components/automations/automation-run-actions.test.tsx`
- Verify: `src/components/automations/automation-run-log.test.tsx`

- [ ] **Step 1: 先写详情页状态容器失败测试，固定 step 事件触发详情重拉 token**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AutomationDetailLive } from "./automation-detail-live";

vi.mock("@/hooks/use-automation-run-realtime", () => ({
  useAutomationRunRealtime: vi.fn(),
}));

vi.mock("@/components/automations/automation-run-log", () => ({
  AutomationRunLog: ({
    detailReloadToken,
  }: {
    detailReloadToken?: number;
  }) => <div data-testid="detail-reload-token">{detailReloadToken}</div>,
}));

describe("AutomationDetailLive", () => {
  it("increments detail reload token when a step update arrives", async () => {
    const useAutomationRunRealtimeMock = (await import("@/hooks/use-automation-run-realtime"))
      .useAutomationRunRealtime as unknown as ReturnType<typeof vi.fn>;

    let onRunStepUpdated: ((event: { runId: string; stepId: string; status: "SUCCEEDED" | "FAILED" }) => void) | undefined;
    useAutomationRunRealtimeMock.mockImplementation((options: { onRunStepUpdated?: typeof onRunStepUpdated }) => {
      onRunStepUpdated = options.onRunStepUpdated;
      return { isConnected: true };
    });

    render(
      <AutomationDetailLive
        automationId="aut-1"
        initialRuns={[
          {
            id: "run-1",
            automationId: "aut-1",
            status: "RUNNING",
            triggerSource: "MANUAL",
            triggerPayload: {},
            contextSnapshot: {},
            startedAt: "2026-04-23T00:00:00.000Z",
            finishedAt: null,
            durationMs: null,
            errorCode: null,
            errorMessage: null,
            createdAt: "2026-04-23T00:00:00.000Z",
          },
        ]}
      />
    );

    expect(screen.getByTestId("detail-reload-token")).toHaveTextContent("0");
    onRunStepUpdated?.({ runId: "run-1", stepId: "step-1", status: "SUCCEEDED" });
    expect(screen.getByTestId("detail-reload-token")).toHaveTextContent("1");
  });
});
```

- [ ] **Step 2: 运行测试，确认先红**

Run: `pnpm vitest run "src/components/automations/automation-run-log.test.tsx"`
Expected: FAIL，`AutomationDetailLive` 还未管理 `detailReloadToken`。

- [ ] **Step 3: 让详情页状态容器维护详情刷新 token**

```tsx
const [detailReloadToken, setDetailReloadToken] = useState(0);

const handleRunUpdated = useCallback((run: AutomationRunItem) => {
  setRuns((current) => upsertRun(current, run));
  if (run.status === "SUCCEEDED" || run.status === "FAILED") {
    setDetailReloadToken((current) => current + 1);
  }
  // keep existing toast logic
}, []);

useAutomationRunRealtime({
  automationId,
  onRunCreated: (run) => setRuns((current) => upsertRun(current, run)),
  onRunUpdated: handleRunUpdated,
  onRunStepUpdated: () => {
    setDetailReloadToken((current) => current + 1);
  },
});

return (
  <div className="space-y-4">
    <AutomationRunActions automationId={automationId} />
    <AutomationRunLog
      items={runs}
      helperText={helperText}
      detailReloadToken={detailReloadToken}
    />
  </div>
);
```

- [ ] **Step 4: 跑模块回归，确保自动化详情页行为收敛**

Run:
- `pnpm vitest run "src/lib/services/automation-run.service.test.ts" "src/lib/services/automation-realtime.service.test.ts"`
- `pnpm vitest run "src/app/api/automations/[id]/realtime/route.test.ts" "src/app/api/automations/[id]/run/route.test.ts"`
- `pnpm vitest run "src/hooks/use-automation-run-realtime.test.ts" "src/components/automations/automation-run-actions.test.tsx" "src/components/automations/automation-run-log.test.tsx"`

Expected: PASS，自动化模块的服务、路由、Hook、组件测试全部通过。

- [ ] **Step 5: 运行 lint 和类型检查**

Run:
- `pnpm eslint "src/types/automation-realtime.ts" "src/lib/services/automation-realtime.service.ts" "src/lib/services/automation-run.service.ts" "src/app/api/automations/[id]/realtime/route.ts" "src/hooks/use-automation-run-realtime.ts" "src/components/automations/automation-detail-live.tsx" "src/components/automations/automation-run-actions.tsx" "src/components/automations/automation-run-log.tsx"`
- `npx tsc --noEmit`

Expected:
- ESLint 无报错
- TypeScript 无报错

- [ ] **Step 6: 手工验证页面行为**

Run: `npm run dev`
Expected:
- 打开 `/automations/<id>`
- 点击“手动运行”后立即看到成功提示
- 列表中出现新的 `PENDING` / `RUNNING` 记录
- 运行结束后 badge 自动切到 `SUCCEEDED` 或 `FAILED`
- 展开详情时，在步骤推进后详情会自动刷新

- [ ] **Step 7: 提交本任务**

```bash
git add "src/components/automations/automation-detail-live.tsx" \
  "src/components/automations/automation-run-log.test.tsx"
git commit -m "feat(automation): refresh run detail on realtime step updates"
```

---

## Self-Review

### Spec coverage

- SSE 实时链路：Task 1, Task 2
- 详情页自动更新：Task 3, Task 4, Task 5
- 手动触发即时反馈：Task 4
- 失败与完成提示：Task 3, Task 4
- 展开详情自动刷新：Task 4, Task 5

没有遗漏项。

### Placeholder scan

- 已检查全文，没有 `TODO`、`TBD`、`implement later` 一类占位词
- 所有代码步骤都提供了明确代码块
- 所有验证步骤都有具体命令

### Type consistency

- SSE 事件文件统一使用 `AutomationRealtimeEvent`
- Hook 统一分发 `onRunCreated` / `onRunUpdated` / `onRunStepUpdated`
- 详情页状态容器统一使用 `detailReloadToken`

命名一致，没有前后漂移。
