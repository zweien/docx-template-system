import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { EnqueueAutomationRunInput } from "@/types/automation";
import type { ServiceResult } from "@/types/data-table";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function computeDurationMs(startedAt: Date | null, finishedAt: Date): number | null {
  if (!startedAt) return null;
  return Math.max(0, finishedAt.getTime() - startedAt.getTime());
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
