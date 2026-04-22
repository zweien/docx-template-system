import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type {
  AutomationActionNode,
  AutomationRunItem,
  AutomationRunBranch,
  AutomationRunStepItem,
  AutomationRunStepStatus,
  EnqueueAutomationRunInput,
} from "@/types/automation";
import type { ServiceResult } from "@/types/data-table";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function computeDurationMs(startedAt: Date | null, finishedAt: Date): number | null {
  if (!startedAt) return null;
  return Math.max(0, finishedAt.getTime() - startedAt.getTime());
}

function mapAutomationRunItem(row: {
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
}): AutomationRunItem {
  return {
    id: row.id,
    automationId: row.automationId,
    status: row.status as AutomationRunItem["status"],
    triggerSource: row.triggerSource as AutomationRunItem["triggerSource"],
    triggerPayload: (row.triggerPayload ?? {}) as Record<string, unknown>,
    contextSnapshot: (row.contextSnapshot ?? {}) as Record<string, unknown>,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    durationMs: row.durationMs,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
  };
}

function mapAutomationRunStepItem(row: {
  id: string;
  runId: string;
  nodeId: string;
  stepType: string;
  branch: string;
  status: string;
  input: unknown;
  output: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
}): AutomationRunStepItem {
  return {
    id: row.id,
    runId: row.runId,
    nodeId: row.nodeId,
    stepType: row.stepType as AutomationRunStepItem["stepType"],
    branch: row.branch as AutomationRunStepItem["branch"],
    status: row.status as AutomationRunStepItem["status"],
    input: (row.input ?? {}) as Record<string, unknown>,
    output: row.output ? (row.output as Record<string, unknown>) : null,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    durationMs: row.durationMs,
  };
}

export async function createAutomationRunStep(input: {
  runId: string;
  nodeId: string;
  stepType: AutomationActionNode["type"];
  branch: AutomationRunBranch;
  status: AutomationRunStepStatus;
  stepInput: unknown;
}): Promise<ServiceResult<{ id: string }>> {
  try {
    const startedAt = input.status === "RUNNING" ? new Date() : null;
    const created = await db.automationRunStep.create({
      data: {
        runId: input.runId,
        nodeId: input.nodeId,
        stepType: input.stepType,
        branch: input.branch,
        status: input.status,
        input: toJsonValue(input.stepInput),
        startedAt,
      },
      select: { id: true },
    });

    return { success: true, data: created };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建自动化步骤记录失败";
    return { success: false, error: { code: "CREATE_RUN_STEP_FAILED", message } };
  }
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
      select: { id: true },
    });

    return { success: true, data: created };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建自动化运行记录失败";
    return { success: false, error: { code: "CREATE_RUN_FAILED", message } };
  }
}

export async function markAutomationRunStarted(runId: string): Promise<ServiceResult<null>> {
  try {
    await db.automationRun.update({
      where: { id: runId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "标记自动化运行开始失败";
    return { success: false, error: { code: "MARK_RUN_STARTED_FAILED", message } };
  }
}

export async function markAutomationRunSucceeded(runId: string): Promise<ServiceResult<null>> {
  try {
    const existing = await db.automationRun.findUnique({
      where: { id: runId },
      select: { startedAt: true },
    });
    const finishedAt = new Date();

    await db.automationRun.update({
      where: { id: runId },
      data: {
        status: "SUCCEEDED",
        finishedAt,
        durationMs: computeDurationMs(existing?.startedAt ?? null, finishedAt),
      },
    });

    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "标记自动化运行成功失败";
    return { success: false, error: { code: "MARK_RUN_SUCCEEDED_FAILED", message } };
  }
}

export async function markAutomationRunFailed(
  runId: string,
  error: { code?: string; message: string }
): Promise<ServiceResult<null>> {
  try {
    const existing = await db.automationRun.findUnique({
      where: { id: runId },
      select: { startedAt: true },
    });
    const finishedAt = new Date();

    await db.automationRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        finishedAt,
        durationMs: computeDurationMs(existing?.startedAt ?? null, finishedAt),
        errorCode: error.code ?? "RUN_FAILED",
        errorMessage: error.message,
      },
    });

    return { success: true, data: null };
  } catch (updateError) {
    const message = updateError instanceof Error ? updateError.message : "标记自动化运行失败失败";
    return { success: false, error: { code: "MARK_RUN_FAILED_FAILED", message } };
  }
}

export async function markAutomationRunStepSucceeded(
  stepId: string,
  output: unknown
): Promise<ServiceResult<null>> {
  try {
    const finishedAt = new Date();
    await db.automationRunStep.update({
      where: { id: stepId },
      data: {
        status: "SUCCEEDED",
        output: toJsonValue(output),
        finishedAt,
      },
    });

    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "标记自动化步骤成功失败";
    return { success: false, error: { code: "MARK_RUN_STEP_SUCCEEDED_FAILED", message } };
  }
}

export async function markAutomationRunStepFailed(
  stepId: string,
  error: { code?: string; message: string }
): Promise<ServiceResult<null>> {
  try {
    const finishedAt = new Date();
    await db.automationRunStep.update({
      where: { id: stepId },
      data: {
        status: "FAILED",
        errorCode: error.code ?? "STEP_FAILED",
        errorMessage: error.message,
        finishedAt,
      },
    });

    return { success: true, data: null };
  } catch (updateError) {
    const message = updateError instanceof Error ? updateError.message : "标记自动化步骤失败失败";
    return { success: false, error: { code: "MARK_RUN_STEP_FAILED_FAILED", message } };
  }
}

export async function createSkippedAutomationRunSteps(input: {
  runId: string;
  branch: AutomationRunBranch;
  actions: AutomationActionNode[];
}): Promise<ServiceResult<null>> {
  try {
    for (const action of input.actions) {
      await db.automationRunStep.create({
        data: {
          runId: input.runId,
          nodeId: action.id,
          stepType: action.type,
          branch: input.branch,
          status: "SKIPPED",
          input: toJsonValue(action),
        },
      });
    }

    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建跳过步骤失败";
    return { success: false, error: { code: "CREATE_SKIPPED_STEPS_FAILED", message } };
  }
}

export async function listAutomationRuns(
  automationId: string,
  userId: string
): Promise<ServiceResult<AutomationRunItem[]>> {
  try {
    const automation = await db.automation.findFirst({
      where: {
        id: automationId,
        createdById: userId,
      },
      select: { id: true },
    });

    if (!automation) {
      return { success: false, error: { code: "NOT_FOUND", message: "自动化不存在" } };
    }

    const rows = await db.automationRun.findMany({
      where: { automationId },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: rows.map(mapAutomationRunItem) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取自动化运行记录失败";
    return { success: false, error: { code: "LIST_RUNS_FAILED", message } };
  }
}

export async function getAutomationRunDetail(
  runId: string,
  userId: string
): Promise<ServiceResult<{ run: AutomationRunItem; steps: AutomationRunStepItem[] }>> {
  try {
    const row = await db.automationRun.findFirst({
      where: {
        id: runId,
        automation: {
          createdById: userId,
        },
      },
      include: {
        steps: {
          orderBy: { startedAt: "asc" },
        },
      },
    });

    if (!row) {
      return { success: false, error: { code: "NOT_FOUND", message: "运行记录不存在" } };
    }

    return {
      success: true,
      data: {
        run: mapAutomationRunItem(row),
        steps: row.steps.map(mapAutomationRunStepItem),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取运行记录详情失败";
    return { success: false, error: { code: "GET_RUN_DETAIL_FAILED", message } };
  }
}
