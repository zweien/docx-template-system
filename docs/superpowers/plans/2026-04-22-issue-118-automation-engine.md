# Automation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable automation system for data tables with constrained canvas editing, event/schedule/manual triggers, conditional branching, four action types, and execution logs.

**Architecture:** Persist one `Automation` record per workflow with a stable JSON DSL plus canvas layout metadata. Route all trigger sources into a single in-process dispatcher that creates `AutomationRun` and `AutomationRunStep` rows, evaluates conditions, then executes either the `then` or `else` linear action chain. The UI exposes a list page, a constrained canvas editor, and a run log view.

**Tech Stack:** Next.js 16, React 19, Prisma 7, PostgreSQL, Zod, `node-cron`, existing shadcn/Base UI components, existing service-layer pattern.

---

## File Structure

### New files

- `src/types/automation.ts`
  Purpose: shared automation DTOs and DSL types.
- `src/validators/automation.ts`
  Purpose: Zod schemas for DSL, CRUD payloads, and manual run requests.
- `src/lib/services/automation.service.ts`
  Purpose: CRUD service for automation definitions.
- `src/lib/services/automation-run.service.ts`
  Purpose: create/list/detail run records and step records.
- `src/lib/services/automation-condition.service.ts`
  Purpose: evaluate automation condition trees against normalized execution context.
- `src/lib/services/automation-dispatcher.service.ts`
  Purpose: enqueue and execute runs with small in-process concurrency.
- `src/lib/services/automation-trigger.service.ts`
  Purpose: unify trigger matching and event fan-out.
- `src/lib/services/automation-scheduler.service.ts`
  Purpose: `node-cron` registration and schedule scan.
- `src/lib/services/automation-action-executors/update-field.ts`
  Purpose: update current record field action executor.
- `src/lib/services/automation-action-executors/create-record.ts`
  Purpose: create record action executor.
- `src/lib/services/automation-action-executors/call-webhook.ts`
  Purpose: webhook action executor.
- `src/lib/services/automation-action-executors/add-comment.ts`
  Purpose: comment action executor.
- `src/lib/services/automation-action-executors/index.ts`
  Purpose: action executor registry.
- `src/app/api/automations/route.ts`
  Purpose: list/create automations.
- `src/app/api/automations/[id]/route.ts`
  Purpose: get/update/delete one automation.
- `src/app/api/automations/[id]/toggle/route.ts`
  Purpose: enable/disable automation.
- `src/app/api/automations/[id]/run/route.ts`
  Purpose: manual trigger endpoint.
- `src/app/api/automations/[id]/runs/route.ts`
  Purpose: list runs for one automation.
- `src/app/api/automations/runs/[runId]/route.ts`
  Purpose: run detail endpoint.
- `src/app/(dashboard)/automations/page.tsx`
  Purpose: automation list page.
- `src/app/(dashboard)/automations/[id]/page.tsx`
  Purpose: automation editor and run log page shell.
- `src/components/automations/automation-list.tsx`
  Purpose: list UI and item actions.
- `src/components/automations/automation-editor.tsx`
  Purpose: constrained canvas editor root.
- `src/components/automations/automation-canvas.tsx`
  Purpose: node/edge rendering and topology constraints.
- `src/components/automations/automation-config-panel.tsx`
  Purpose: selected node configuration panel.
- `src/components/automations/automation-run-log.tsx`
  Purpose: run list and step detail UI.
- `src/components/automations/automation-editor.test.tsx`
  Purpose: editor topology and save validation tests.
- `src/lib/services/automation-condition.service.test.ts`
  Purpose: condition evaluation unit tests.
- `src/lib/services/automation-run.service.test.ts`
  Purpose: dispatcher/run logging tests.
- `src/lib/services/automation-action-executors/update-field.test.ts`
  Purpose: update field executor tests.
- `src/lib/services/automation-action-executors/create-record.test.ts`
  Purpose: create record executor tests.
- `src/lib/services/automation-action-executors/call-webhook.test.ts`
  Purpose: webhook executor tests.
- `src/lib/services/automation-action-executors/add-comment.test.ts`
  Purpose: comment executor tests.

### Modified files

- `prisma/schema.prisma`
  Purpose: add `Automation`, `AutomationRun`, `AutomationRunStep`.
- `src/types/data-table.ts`
  Purpose: optional light references for table-scoped automation list counts if needed by existing pages.
- `src/lib/services/data-record.service.ts`
  Purpose: dispatch record create/update/delete automation events.
- `src/app/(dashboard)/layout.tsx`
  Purpose: add automation navigation entry if the project keeps layout-owned nav.
- `src/components/layout/navigation/schema.ts`
  Purpose: add `/automations` nav entry.
- `src/instrumentation.ts`
  Purpose: register scheduler boot hook if this file already hosts startup side effects.
- `package.json`
  Purpose: no new dependency expected besides existing `node-cron`; only modify if a graph editor lib is required.

---

### Task 1: Add Prisma Models and Shared Types

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/types/automation.ts`
- Test: `src/lib/services/automation-run.service.test.ts`

- [ ] **Step 1: Write the failing type-oriented test scaffold**

```ts
import { describe, expect, it } from "vitest";
import type { AutomationDefinition } from "@/types/automation";

describe("automation definition types", () => {
  it("supports a constrained trigger -> condition -> branch action shape", () => {
    const definition: AutomationDefinition = {
      version: 1,
      canvas: {
        nodes: [
          { id: "trigger-1", type: "trigger", x: 80, y: 120 },
          { id: "condition-1", type: "condition", x: 320, y: 120 },
          { id: "action-then-1", type: "action", x: 580, y: 60 },
          { id: "action-else-1", type: "action", x: 580, y: 180 },
        ],
        edges: [
          { source: "trigger-1", target: "condition-1" },
          { source: "condition-1", target: "action-then-1", handle: "then" },
          { source: "condition-1", target: "action-else-1", handle: "else" },
        ],
      },
      trigger: { type: "record_created" },
      condition: null,
      thenActions: [{ id: "action-then-1", type: "add_comment", target: "current_record", content: "created" }],
      elseActions: [],
    };

    expect(definition.version).toBe(1);
    expect(definition.thenActions).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify type imports fail before implementation**

Run: `pnpm vitest run "src/lib/services/automation-run.service.test.ts"`
Expected: FAIL with missing module or missing `AutomationDefinition` export.

- [ ] **Step 3: Add Prisma models**

```prisma
model Automation {
  id                String   @id @default(cuid())
  tableId           String
  name              String
  description       String?
  enabled           Boolean  @default(true)
  triggerType       String
  definitionVersion Int      @default(1)
  definition        Json
  createdById       String
  updatedById       String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  table             DataTable      @relation(fields: [tableId], references: [id], onDelete: Cascade)
  createdBy         User           @relation("AutomationCreatedBy", fields: [createdById], references: [id], onDelete: Cascade)
  updatedBy         User?          @relation("AutomationUpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull)
  runs              AutomationRun[]

  @@index([tableId, enabled])
  @@index([createdById])
}

model AutomationRun {
  id              String   @id @default(cuid())
  automationId    String
  status          String
  triggerSource   String
  triggerPayload  Json
  contextSnapshot Json
  startedAt       DateTime?
  finishedAt      DateTime?
  durationMs      Int?
  errorCode       String?
  errorMessage    String?
  createdAt       DateTime @default(now())

  automation      Automation          @relation(fields: [automationId], references: [id], onDelete: Cascade)
  steps           AutomationRunStep[]

  @@index([automationId, createdAt])
  @@index([status, createdAt])
}

model AutomationRunStep {
  id           String   @id @default(cuid())
  runId        String
  nodeId       String
  stepType     String
  branch       String
  status       String
  input        Json
  output       Json?
  errorCode    String?
  errorMessage String?
  startedAt    DateTime?
  finishedAt   DateTime?
  durationMs   Int?

  run          AutomationRun @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@index([runId, branch])
  @@index([runId, nodeId])
}
```

- [ ] **Step 4: Add shared DSL and DTO types**

```ts
export type AutomationTrigger =
  | { type: "record_created" }
  | { type: "record_updated"; fieldKeys?: string[] }
  | { type: "record_deleted" }
  | { type: "field_changed"; fieldKey: string; from?: unknown; to?: unknown }
  | { type: "schedule"; schedule: { mode: "daily" | "weekly" | "monthly"; time: string; weekday?: number; dayOfMonth?: number } }
  | { type: "manual" };

export type AutomationConditionLeaf = {
  kind: "leaf";
  field: string;
  op: "eq" | "ne" | "contains" | "gt" | "lt";
  value: unknown;
};

export type AutomationConditionGroup = {
  kind: "group";
  operator: "AND" | "OR";
  conditions: Array<AutomationConditionLeaf | AutomationConditionGroup>;
};

export type AutomationActionNode =
  | { id: string; type: "update_field"; fieldKey: string; value: unknown }
  | { id: string; type: "create_record"; tableId: string; values: Record<string, unknown> }
  | { id: string; type: "call_webhook"; url: string; method: "POST" | "PUT"; headers?: Record<string, string>; body?: unknown }
  | { id: string; type: "add_comment"; target: "current_record"; content: string };

export type AutomationDefinition = {
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

- [ ] **Step 5: Run schema and type generation**

Run: `npx prisma db push && npx prisma generate`
Expected: PASS and generated Prisma client updated.

- [ ] **Step 6: Run the scaffold test**

Run: `pnpm vitest run "src/lib/services/automation-run.service.test.ts"`
Expected: PASS for the type scaffold test.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma src/types/automation.ts
git commit -m "feat(automation): add automation persistence models"
```

### Task 2: Add Validators and Automation CRUD Service

**Files:**
- Create: `src/validators/automation.ts`
- Create: `src/lib/services/automation.service.ts`
- Test: `src/lib/services/automation-run.service.test.ts`

- [ ] **Step 1: Write a failing validator/service test**

```ts
import { describe, expect, it, vi } from "vitest";
import { createAutomation } from "./automation.service";

vi.mock("@/lib/db", () => ({
  db: {
    automation: {
      create: vi.fn(),
    },
  },
}));

describe("createAutomation", () => {
  it("rejects invalid canvas topology with two trigger nodes", async () => {
    const result = await createAutomation({
      tableId: "tbl_1",
      userId: "usr_1",
      input: {
        name: "Broken",
        enabled: true,
        triggerType: "record_created",
        definition: {
          version: 1,
          canvas: {
            nodes: [
              { id: "trigger-a", type: "trigger", x: 0, y: 0 },
              { id: "trigger-b", type: "trigger", x: 1, y: 1 },
            ],
            edges: [],
          },
          trigger: { type: "record_created" },
          condition: null,
          thenActions: [],
          elseActions: [],
        },
      },
    });

    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm vitest run "src/lib/services/automation-run.service.test.ts" -t "rejects invalid canvas topology"`
Expected: FAIL because `createAutomation` does not exist yet.

- [ ] **Step 3: Add Zod schemas**

```ts
export const automationTriggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("record_created") }),
  z.object({ type: z.literal("record_updated"), fieldKeys: z.array(z.string()).optional() }),
  z.object({ type: z.literal("record_deleted") }),
  z.object({ type: z.literal("field_changed"), fieldKey: z.string().min(1), from: z.unknown().optional(), to: z.unknown().optional() }),
  z.object({
    type: z.literal("schedule"),
    schedule: z.object({
      mode: z.enum(["daily", "weekly", "monthly"]),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      weekday: z.number().int().min(0).max(6).optional(),
      dayOfMonth: z.number().int().min(1).max(31).optional(),
    }),
  }),
  z.object({ type: z.literal("manual") }),
]);

export const automationDefinitionSchema = z.object({
  version: z.literal(1),
  canvas: z.object({
    nodes: z.array(z.object({ id: z.string().min(1), type: z.string().min(1), x: z.number(), y: z.number() })),
    edges: z.array(z.object({ source: z.string().min(1), target: z.string().min(1), handle: z.string().optional() })),
  }),
  trigger: automationTriggerSchema,
  condition: z.unknown().nullable(),
  thenActions: z.array(z.unknown()),
  elseActions: z.array(z.unknown()),
});
```

- [ ] **Step 4: Implement CRUD service with topology validation**

```ts
function validateDefinitionTopology(definition: AutomationDefinition): string | null {
  const triggerNodes = definition.canvas.nodes.filter((node) => node.type === "trigger");
  const conditionNodes = definition.canvas.nodes.filter((node) => node.type === "condition");

  if (triggerNodes.length !== 1) return "必须且只能存在一个触发器节点";
  if (conditionNodes.length > 1) return "第一期仅支持一个条件节点";

  const duplicateThen = definition.canvas.edges.filter((edge) => edge.handle === "then").length > definition.thenActions.length;
  if (duplicateThen) return "Then 分支拓扑无效";

  return null;
}

export async function createAutomation(params: {
  tableId: string;
  userId: string;
  input: z.infer<typeof createAutomationSchema>;
}): Promise<ServiceResult<AutomationDetail>> {
  const invalidTopology = validateDefinitionTopology(params.input.definition);
  if (invalidTopology) {
    return { success: false, error: { code: "INVALID_DEFINITION", message: invalidTopology } };
  }

  const created = await db.automation.create({
    data: {
      tableId: params.tableId,
      name: params.input.name,
      description: params.input.description ?? null,
      enabled: params.input.enabled,
      triggerType: params.input.triggerType,
      definitionVersion: 1,
      definition: params.input.definition,
      createdById: params.userId,
      updatedById: params.userId,
    },
  });

  return { success: true, data: mapAutomationDetail(created) };
}
```

- [ ] **Step 5: Run the focused test**

Run: `pnpm vitest run "src/lib/services/automation-run.service.test.ts" -t "rejects invalid canvas topology"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/validators/automation.ts src/lib/services/automation.service.ts src/lib/services/automation-run.service.test.ts
git commit -m "feat(automation): add automation validators and crud service"
```

### Task 3: Add Automation CRUD APIs

**Files:**
- Create: `src/app/api/automations/route.ts`
- Create: `src/app/api/automations/[id]/route.ts`
- Create: `src/app/api/automations/[id]/toggle/route.ts`
- Test: `src/lib/services/automation-run.service.test.ts`

- [ ] **Step 1: Write a failing API smoke test**

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "usr_1", role: "ADMIN" } })),
}));

describe("api/automations", () => {
  it("returns 401 when session is missing", async () => {
    const { GET } = await import("@/app/api/automations/route");
    vi.doMock("@/lib/auth", () => ({ auth: vi.fn(async () => null) }));
    const response = await GET();
    expect(response.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm vitest run "src/lib/services/automation-run.service.test.ts" -t "returns 401 when session is missing"`
Expected: FAIL because route file does not exist.

- [ ] **Step 3: Implement list/create route**

```ts
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const result = await listAutomations(session.user.id);
  return result.success
    ? NextResponse.json({ success: true, data: result.data })
    : NextResponse.json({ error: result.error.message }, { status: 400 });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createAutomationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "数据验证失败", details: parsed.error.issues }, { status: 400 });
  }

  const result = await createAutomation({
    tableId: parsed.data.tableId,
    userId: session.user.id,
    input: parsed.data,
  });

  return result.success
    ? NextResponse.json({ success: true, data: result.data })
    : NextResponse.json({ error: result.error.message }, { status: 400 });
}
```

- [ ] **Step 4: Implement detail/update/delete/toggle routes**

```ts
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateAutomationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "数据验证失败", details: parsed.error.issues }, { status: 400 });
  }

  const result = await updateAutomation(id, session.user.id, parsed.data);
  return result.success
    ? NextResponse.json({ success: true, data: result.data })
    : NextResponse.json({ error: result.error.message }, { status: 400 });
}
```

- [ ] **Step 5: Run the smoke test**

Run: `pnpm vitest run "src/lib/services/automation-run.service.test.ts" -t "returns 401 when session is missing"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/automations
git commit -m "feat(automation): add automation crud api"
```

### Task 4: Add Run Logging and Dispatcher Skeleton

**Files:**
- Create: `src/lib/services/automation-run.service.ts`
- Create: `src/lib/services/automation-dispatcher.service.ts`
- Test: `src/lib/services/automation-run.service.test.ts`

- [ ] **Step 1: Write the failing run lifecycle test**

```ts
import { describe, expect, it, vi } from "vitest";
import { enqueueAutomationRun } from "./automation-dispatcher.service";

describe("enqueueAutomationRun", () => {
  it("creates a pending run before execution", async () => {
    const result = await enqueueAutomationRun({
      automationId: "aut_1",
      triggerSource: "MANUAL",
      triggerPayload: { source: "manual" },
      contextSnapshot: { tableId: "tbl_1", record: null, previousRecord: null, changedFields: [], triggeredAt: "2026-04-22T00:00:00.000Z", actor: { id: "usr_1" } },
    });

    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm vitest run "src/lib/services/automation-run.service.test.ts" -t "creates a pending run before execution"`
Expected: FAIL because dispatcher does not exist.

- [ ] **Step 3: Implement run persistence helpers**

```ts
export async function createAutomationRun(input: {
  automationId: string;
  triggerSource: "EVENT" | "SCHEDULE" | "MANUAL";
  triggerPayload: Record<string, unknown>;
  contextSnapshot: Record<string, unknown>;
}): Promise<ServiceResult<{ id: string }>> {
  const created = await db.automationRun.create({
    data: {
      automationId: input.automationId,
      status: "PENDING",
      triggerSource: input.triggerSource,
      triggerPayload: input.triggerPayload,
      contextSnapshot: input.contextSnapshot,
    },
    select: { id: true },
  });

  return { success: true, data: created };
}
```

- [ ] **Step 4: Implement dispatcher skeleton**

```ts
const queue: Array<() => Promise<void>> = [];
let activeCount = 0;
const MAX_CONCURRENCY = 1;

function pumpQueue() {
  if (activeCount >= MAX_CONCURRENCY) return;
  const job = queue.shift();
  if (!job) return;
  activeCount += 1;
  void job().finally(() => {
    activeCount -= 1;
    pumpQueue();
  });
}

export async function enqueueAutomationRun(input: EnqueueAutomationRunInput) {
  const run = await createAutomationRun(input);
  if (!run.success) return run;

  queue.push(async () => {
    await markRunStarted(run.data.id);
    await markRunSucceeded(run.data.id);
  });
  pumpQueue();

  return run;
}
```

- [ ] **Step 5: Run the focused test**

Run: `pnpm vitest run "src/lib/services/automation-run.service.test.ts" -t "creates a pending run before execution"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/automation-run.service.ts src/lib/services/automation-dispatcher.service.ts src/lib/services/automation-run.service.test.ts
git commit -m "feat(automation): add run logging and dispatcher skeleton"
```

### Task 5: Implement Condition Evaluation

**Files:**
- Create: `src/lib/services/automation-condition.service.ts`
- Create: `src/lib/services/automation-condition.service.test.ts`

- [ ] **Step 1: Write failing condition tests**

```ts
import { describe, expect, it } from "vitest";
import { evaluateAutomationCondition } from "./automation-condition.service";

describe("evaluateAutomationCondition", () => {
  it("evaluates nested AND/OR groups", () => {
    const result = evaluateAutomationCondition(
      {
        kind: "group",
        operator: "AND",
        conditions: [
          { kind: "leaf", field: "record.status", op: "eq", value: "done" },
          {
            kind: "group",
            operator: "OR",
            conditions: [
              { kind: "leaf", field: "record.score", op: "gt", value: 80 },
              { kind: "leaf", field: "record.priority", op: "eq", value: "high" },
            ],
          },
        ],
      },
      {
        record: { status: "done", score: 70, priority: "high" },
        previousRecord: null,
        changedFields: [],
        triggerSource: "EVENT",
      }
    );

    expect(result).toBe(true);
  });

  it("supports changed field checks through explicit context", () => {
    const result = evaluateAutomationCondition(
      { kind: "leaf", field: "changedFields", op: "contains", value: "status" },
      {
        record: { status: "done" },
        previousRecord: { status: "draft" },
        changedFields: ["status"],
        triggerSource: "EVENT",
      }
    );

    expect(result).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `pnpm vitest run "src/lib/services/automation-condition.service.test.ts"`
Expected: FAIL because evaluator does not exist.

- [ ] **Step 3: Implement evaluator**

```ts
function readContextField(field: string, context: AutomationConditionContext): unknown {
  if (field === "changedFields") return context.changedFields;
  if (field === "triggerSource") return context.triggerSource;

  const [root, ...rest] = field.split(".");
  const source = root === "record" ? context.record : root === "previousRecord" ? context.previousRecord : null;
  return rest.reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
}

export function evaluateAutomationCondition(
  condition: AutomationConditionLeaf | AutomationConditionGroup,
  context: AutomationConditionContext
): boolean {
  if (condition.kind === "group") {
    return condition.operator === "AND"
      ? condition.conditions.every((item) => evaluateAutomationCondition(item, context))
      : condition.conditions.some((item) => evaluateAutomationCondition(item, context));
  }

  const actual = readContextField(condition.field, context);
  switch (condition.op) {
    case "eq":
      return String(actual ?? "") === String(condition.value);
    case "ne":
      return String(actual ?? "") !== String(condition.value);
    case "contains":
      return Array.isArray(actual)
        ? actual.map(String).includes(String(condition.value))
        : String(actual ?? "").includes(String(condition.value));
    case "gt":
      return Number(actual) > Number(condition.value);
    case "lt":
      return Number(actual) < Number(condition.value);
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run "src/lib/services/automation-condition.service.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/automation-condition.service.ts src/lib/services/automation-condition.service.test.ts
git commit -m "feat(automation): add condition evaluation engine"
```

### Task 6: Implement Action Executors

**Files:**
- Create: `src/lib/services/automation-action-executors/update-field.ts`
- Create: `src/lib/services/automation-action-executors/create-record.ts`
- Create: `src/lib/services/automation-action-executors/call-webhook.ts`
- Create: `src/lib/services/automation-action-executors/add-comment.ts`
- Create: `src/lib/services/automation-action-executors/index.ts`
- Test: `src/lib/services/automation-action-executors/*.test.ts`

- [ ] **Step 1: Write failing executor tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { executeUpdateFieldAction } from "./update-field";

describe("executeUpdateFieldAction", () => {
  it("fails when current record is missing", async () => {
    const result = await executeUpdateFieldAction({
      action: { id: "a1", type: "update_field", fieldKey: "status", value: "done" },
      context: {
        automationId: "aut_1",
        tableId: "tbl_1",
        record: null,
        previousRecord: null,
        changedFields: [],
        triggerSource: "MANUAL",
        triggeredAt: "2026-04-22T00:00:00.000Z",
        actor: { id: "usr_1" },
      },
      runId: "run_1",
    });

    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `pnpm vitest run "src/lib/services/automation-action-executors/update-field.test.ts"`
Expected: FAIL because executor file does not exist.

- [ ] **Step 3: Implement minimal executors**

```ts
export async function executeUpdateFieldAction(params: ExecutorParams<UpdateFieldAction>) {
  if (!params.context.record || typeof params.context.record.id !== "string") {
    return { success: false, error: { code: "RECORD_REQUIRED", message: "当前动作需要记录上下文" } };
  }

  return updateRecord(String(params.context.record.id), {
    [params.action.fieldKey]: params.action.value,
  }, params.context.actor.id ?? "system");
}
```

```ts
export async function executeCreateRecordAction(params: ExecutorParams<CreateRecordAction>) {
  return createRecord(params.context.actor.id ?? "system", params.action.tableId, params.action.values);
}
```

```ts
export async function executeCallWebhookAction(params: ExecutorParams<CallWebhookAction>) {
  const response = await fetch(params.action.url, {
    method: params.action.method,
    headers: { "Content-Type": "application/json", ...(params.action.headers ?? {}) },
    body: JSON.stringify(params.action.body ?? params.context.record ?? {}),
  });

  if (!response.ok) {
    return { success: false, error: { code: "WEBHOOK_FAILED", message: `Webhook returned ${response.status}` } };
  }

  return { success: true, data: { status: response.status } };
}
```

```ts
export async function executeAddCommentAction(params: ExecutorParams<AddCommentAction>) {
  if (!params.context.record || typeof params.context.record.id !== "string") {
    return { success: false, error: { code: "RECORD_REQUIRED", message: "当前动作需要记录上下文" } };
  }

  return createComment(params.context.actor.id ?? "system", {
    recordId: String(params.context.record.id),
    content: params.action.content,
  });
}
```

- [ ] **Step 4: Add executor registry**

```ts
export function getAutomationActionExecutor(action: AutomationActionNode) {
  switch (action.type) {
    case "update_field":
      return executeUpdateFieldAction;
    case "create_record":
      return executeCreateRecordAction;
    case "call_webhook":
      return executeCallWebhookAction;
    case "add_comment":
      return executeAddCommentAction;
  }
}
```

- [ ] **Step 5: Run executor tests**

Run: `pnpm vitest run "src/lib/services/automation-action-executors/update-field.test.ts" "src/lib/services/automation-action-executors/create-record.test.ts" "src/lib/services/automation-action-executors/call-webhook.test.ts" "src/lib/services/automation-action-executors/add-comment.test.ts"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/automation-action-executors
git commit -m "feat(automation): add automation action executors"
```

### Task 7: Execute Full Runs and Wire Trigger Sources

**Files:**
- Modify: `src/lib/services/automation-dispatcher.service.ts`
- Create: `src/lib/services/automation-trigger.service.ts`
- Create: `src/lib/services/automation-scheduler.service.ts`
- Modify: `src/lib/services/data-record.service.ts`
- Modify: `src/instrumentation.ts`
- Create: `src/app/api/automations/[id]/run/route.ts`
- Test: `src/lib/services/automation-run.service.test.ts`

- [ ] **Step 1: Write the failing run execution test**

```ts
import { describe, expect, it, vi } from "vitest";
import { executeQueuedAutomationRun } from "./automation-dispatcher.service";

describe("executeQueuedAutomationRun", () => {
  it("marks later actions skipped when one action fails", async () => {
    const result = await executeQueuedAutomationRun({
      runId: "run_1",
      automation: {
        id: "aut_1",
        definition: {
          version: 1,
          canvas: { nodes: [], edges: [] },
          trigger: { type: "manual" },
          condition: null,
          thenActions: [
            { id: "a1", type: "call_webhook", url: "https://example.invalid", method: "POST" },
            { id: "a2", type: "add_comment", target: "current_record", content: "later" },
          ],
          elseActions: [],
        },
      },
      context: {
        automationId: "aut_1",
        tableId: "tbl_1",
        record: { id: "rec_1" },
        previousRecord: null,
        changedFields: [],
        triggerSource: "MANUAL",
        triggeredAt: "2026-04-22T00:00:00.000Z",
        actor: { id: "usr_1" },
      },
    });

    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm vitest run "src/lib/services/automation-run.service.test.ts" -t "marks later actions skipped"`
Expected: FAIL because full execution path does not exist.

- [ ] **Step 3: Implement run execution**

```ts
export async function executeQueuedAutomationRun(input: ExecuteQueuedAutomationRunInput) {
  await markRunStarted(input.runId);

  const branch = input.automation.definition.condition
    ? evaluateAutomationCondition(input.automation.definition.condition, input.context)
      ? "THEN"
      : "ELSE"
    : "THEN";

  const actions = branch === "THEN"
    ? input.automation.definition.thenActions
    : input.automation.definition.elseActions;

  for (const action of actions) {
    await createRunStep({ runId: input.runId, nodeId: action.id, stepType: action.type, branch, status: "RUNNING", input: action });
    const executor = getAutomationActionExecutor(action);
    const result = await executor({ action, context: input.context, runId: input.runId });
    if (!result.success) {
      await failRunStep(input.runId, action.id, result.error);
      await markRunFailed(input.runId, result.error);
      await markRemainingStepsSkipped(input.runId, actions.slice(actions.indexOf(action) + 1), branch);
      return result;
    }
    await succeedRunStep(input.runId, action.id, result.data ?? null);
  }

  await markRunSucceeded(input.runId);
  return { success: true, data: { runId: input.runId } };
}
```

- [ ] **Step 4: Wire record service trigger dispatch**

```ts
void dispatchAutomationEvent({
  tableId,
  triggerType: "record_updated",
  record: updatedRecord.data,
  previousRecord: oldRecord?.data ?? null,
  changedFields,
  actorId: userId,
});
```

- [ ] **Step 5: Add manual run route and scheduler registration**

```ts
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;
  const result = await triggerAutomationManually(id, session.user.id);
  return result.success
    ? NextResponse.json({ success: true, data: result.data })
    : NextResponse.json({ error: result.error.message }, { status: 400 });
}
```

```ts
export function registerAutomationScheduler() {
  cron.schedule("* * * * *", async () => {
    await dispatchScheduledAutomations();
  });
}
```

- [ ] **Step 6: Run the focused test**

Run: `pnpm vitest run "src/lib/services/automation-run.service.test.ts" -t "marks later actions skipped"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/services/automation-dispatcher.service.ts src/lib/services/automation-trigger.service.ts src/lib/services/automation-scheduler.service.ts src/lib/services/data-record.service.ts src/instrumentation.ts src/app/api/automations/[id]/run/route.ts
git commit -m "feat(automation): wire trigger sources into run execution"
```

### Task 8: Build Automation List and Run Log UI

**Files:**
- Create: `src/app/(dashboard)/automations/page.tsx`
- Create: `src/components/automations/automation-list.tsx`
- Create: `src/components/automations/automation-run-log.tsx`
- Modify: `src/components/layout/navigation/schema.ts`

- [ ] **Step 1: Write the failing list page smoke test**

```tsx
import { render, screen } from "@testing-library/react";
import { AutomationList } from "./automation-list";

describe("AutomationList", () => {
  it("renders automation name and trigger label", () => {
    render(
      <AutomationList
        items={[
          {
            id: "aut_1",
            name: "Record Created Webhook",
            tableId: "tbl_1",
            tableName: "Tasks",
            enabled: true,
            triggerType: "record_created",
            latestRunStatus: "SUCCEEDED",
            updatedAt: "2026-04-22T00:00:00.000Z",
          },
        ]}
      />
    );

    expect(screen.getByText("Record Created Webhook")).toBeInTheDocument();
    expect(screen.getByText("record_created")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm vitest run "src/components/automations/automation-editor.test.tsx" -t "renders automation name and trigger label"`
Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement list and run log components**

```tsx
export function AutomationList({ items }: { items: AutomationListItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <div className="font-medium">{item.name}</div>
              <div className="text-xs text-muted-foreground">{item.tableName} · {item.triggerType}</div>
            </div>
            <Badge variant={item.enabled ? "default" : "secondary"}>{item.enabled ? "已启用" : "已停用"}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Implement page and navigation entry**

```ts
{
  id: "automations",
  label: "自动化",
  href: "/automations",
  icon: Bot,
  order: 65,
}
```

```tsx
export default async function AutomationsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const result = await listAutomations(session.user.id);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">自动化</h1>
        <p className="text-sm text-muted-foreground">管理表级触发器、条件分支和动作执行。</p>
      </div>
      <AutomationList items={result.success ? result.data : []} />
    </div>
  );
}
```

- [ ] **Step 5: Run the smoke test**

Run: `pnpm vitest run "src/components/automations/automation-editor.test.tsx" -t "renders automation name and trigger label"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/automations/page.tsx src/components/automations/automation-list.tsx src/components/automations/automation-run-log.tsx src/components/layout/navigation/schema.ts
git commit -m "feat(automation): add automation list and run log ui"
```

### Task 9: Build Constrained Canvas Editor

**Files:**
- Create: `src/app/(dashboard)/automations/[id]/page.tsx`
- Create: `src/components/automations/automation-editor.tsx`
- Create: `src/components/automations/automation-canvas.tsx`
- Create: `src/components/automations/automation-config-panel.tsx`
- Create: `src/components/automations/automation-editor.test.tsx`

- [ ] **Step 1: Write failing topology tests**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { AutomationEditor } from "./automation-editor";

describe("AutomationEditor", () => {
  it("blocks saving when more than one trigger node exists", async () => {
    render(
      <AutomationEditor
        initialValue={{
          version: 1,
          canvas: {
            nodes: [
              { id: "trigger-1", type: "trigger", x: 0, y: 0 },
              { id: "trigger-2", type: "trigger", x: 20, y: 20 },
            ],
            edges: [],
          },
          trigger: { type: "record_created" },
          condition: null,
          thenActions: [],
          elseActions: [],
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "保存自动化" }));
    expect(await screen.findByText("必须且只能存在一个触发器节点")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm vitest run "src/components/automations/automation-editor.test.tsx"`
Expected: FAIL because editor does not exist.

- [ ] **Step 3: Implement constrained editor shell**

```tsx
export function AutomationEditor({ initialValue }: { initialValue: AutomationDefinition }) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  function validateBeforeSave(nextValue: AutomationDefinition) {
    const triggerNodes = nextValue.canvas.nodes.filter((node) => node.type === "trigger");
    if (triggerNodes.length !== 1) return "必须且只能存在一个触发器节点";
    return null;
  }

  return (
    <div className="grid grid-cols-[220px_1fr_320px] gap-4">
      <AutomationCanvas value={value} onChange={setValue} />
      <AutomationConfigPanel value={value} onChange={setValue} />
      <Button
        onClick={() => {
          const validationError = validateBeforeSave(value);
          setError(validationError);
        }}
      >
        保存自动化
      </Button>
      {error ? <div className="text-sm text-destructive">{error}</div> : null}
    </div>
  );
}
```

- [ ] **Step 4: Add save integration**

```tsx
const response = await fetch(`/api/automations/${automationId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name,
    description,
    enabled,
    triggerType: value.trigger.type,
    definition: value,
  }),
});
```

- [ ] **Step 5: Run the test**

Run: `pnpm vitest run "src/components/automations/automation-editor.test.tsx"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/automations/[id]/page.tsx src/components/automations/automation-editor.tsx src/components/automations/automation-canvas.tsx src/components/automations/automation-config-panel.tsx src/components/automations/automation-editor.test.tsx
git commit -m "feat(automation): add constrained canvas editor"
```

### Task 10: End-to-End Verification and Docs Sync

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-04-22-issue-118-automation-engine-design.md` only if implementation forced a spec correction

- [ ] **Step 1: Run focused automation test suite**

Run: `pnpm vitest run "src/lib/services/automation-condition.service.test.ts" "src/lib/services/automation-run.service.test.ts" "src/lib/services/automation-action-executors/update-field.test.ts" "src/lib/services/automation-action-executors/create-record.test.ts" "src/lib/services/automation-action-executors/call-webhook.test.ts" "src/lib/services/automation-action-executors/add-comment.test.ts" "src/components/automations/automation-editor.test.tsx"`
Expected: PASS.

- [ ] **Step 2: Run lint on touched automation files**

Run: `pnpm eslint "src/types/automation.ts" "src/validators/automation.ts" "src/lib/services/automation.service.ts" "src/lib/services/automation-run.service.ts" "src/lib/services/automation-condition.service.ts" "src/lib/services/automation-dispatcher.service.ts" "src/lib/services/automation-trigger.service.ts" "src/lib/services/automation-scheduler.service.ts" "src/lib/services/automation-action-executors" "src/app/api/automations" "src/app/(dashboard)/automations" "src/components/automations"`
Expected: PASS.

- [ ] **Step 3: Run type-check**

Run: `npx tsc --noEmit`
Expected: PASS, or only pre-existing unrelated failures documented before merge.

- [ ] **Step 4: Update README automation section**

```md
## Automations

The app includes a first-stage table automation engine with:

- Record created / updated / deleted triggers
- Field changed, manual, and schedule triggers
- Conditional branching with `then` / `else`
- Actions for updating fields, creating records, calling webhooks, and adding comments
- Run logs for each automation execution
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs(automation): document automation engine usage"
```

## Self-Review

### Spec coverage

- Trigger types: covered in Tasks 1, 2, and 7.
- Condition branching: covered in Tasks 1, 5, and 7.
- Action types: covered in Task 6.
- Management UI: covered in Tasks 8 and 9.
- Run logs: covered in Tasks 4 and 8.
- Scheduler/manual runtime: covered in Task 7.

No spec gap remains.

### Placeholder scan

- No `TODO`, `TBD`, or “similar to above” placeholders remain.
- Every code-writing step includes concrete code snippets.
- Every verification step includes exact commands and expected outcomes.

### Type consistency

- `AutomationDefinition`, `AutomationConditionGroup`, and `AutomationActionNode` are introduced in Task 1 and reused consistently in Tasks 2, 5, 6, and 9.
- `AutomationRun` / `AutomationRunStep` are defined in Task 1 and used consistently in Tasks 4 and 7.
- Trigger source enum values are consistently `EVENT | SCHEDULE | MANUAL`.
