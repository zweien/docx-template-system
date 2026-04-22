import {
  createAutomationRunStep,
  createSkippedAutomationRunSteps,
  createAutomationRun,
  markAutomationRunFailed,
  markAutomationRunStarted,
  markAutomationRunStepFailed,
  markAutomationRunStepSucceeded,
  markAutomationRunSucceeded,
} from "@/lib/services/automation-run.service";
import { getAutomationActionExecutor } from "@/lib/services/automation-action-executors";
import { evaluateAutomationCondition } from "@/lib/services/automation-condition.service";
import { db } from "@/lib/db";
import type {
  AutomationActionContext,
  AutomationDefinition,
  AutomationExecutionTarget,
  EnqueueAutomationRunInput,
} from "@/types/automation";
import type { ServiceResult } from "@/types/data-table";

const queue: Array<() => Promise<void>> = [];
const MAX_CONCURRENCY = 1;
let activeCount = 0;

function pumpQueue(): void {
  if (activeCount >= MAX_CONCURRENCY) return;

  const job = queue.shift();
  if (!job) return;

  activeCount += 1;
  void job().finally(() => {
    activeCount -= 1;
    pumpQueue();
  });
}

export interface ExecuteQueuedAutomationRunInput {
  runId: string;
  automation: AutomationExecutionTarget;
  context: AutomationActionContext;
}

async function loadAutomationExecutionTarget(
  input: EnqueueAutomationRunInput
): Promise<ServiceResult<AutomationExecutionTarget>> {
  if (input.automation) {
    return { success: true, data: input.automation };
  }

  try {
    const row = await db.automation.findUnique({
      where: { id: input.automationId },
      select: {
        id: true,
        tableId: true,
        definition: true,
      },
    });

    if (!row) {
      return { success: false, error: { code: "NOT_FOUND", message: "自动化不存在" } };
    }

    return {
      success: true,
      data: {
        id: row.id,
        tableId: row.tableId,
        definition: row.definition as AutomationDefinition,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "加载自动化定义失败";
    return { success: false, error: { code: "LOAD_AUTOMATION_FAILED", message } };
  }
}

export async function executeQueuedAutomationRun(
  input: ExecuteQueuedAutomationRunInput
): Promise<ServiceResult<{ runId: string }>> {
  const started = await markAutomationRunStarted(input.runId);
  if (!started.success) {
    await markAutomationRunFailed(input.runId, started.error);
    return { success: false, error: started.error };
  }

  const branch = input.automation.definition.condition
    ? evaluateAutomationCondition(input.automation.definition.condition, input.context)
      ? "THEN"
      : "ELSE"
    : "THEN";
  const actions =
    branch === "THEN"
      ? input.automation.definition.thenActions
      : input.automation.definition.elseActions;

  for (const [index, action] of actions.entries()) {
    const step = await createAutomationRunStep({
      runId: input.runId,
      nodeId: action.id,
      stepType: action.type,
      branch,
      status: "RUNNING",
      stepInput: action,
    });

    if (!step.success) {
      await markAutomationRunFailed(input.runId, step.error);
      return { success: false, error: step.error };
    }

    try {
      const executor = getAutomationActionExecutor(action);
      const result = await executor({
        action,
        context: input.context,
        runId: input.runId,
      });

      if (!result.success) {
        await markAutomationRunStepFailed(step.data.id, result.error);
        await createSkippedAutomationRunSteps({
          runId: input.runId,
          branch,
          actions: actions.slice(index + 1),
        });
        await markAutomationRunFailed(input.runId, result.error);
        return { success: false, error: result.error };
      }

      const stepSucceeded = await markAutomationRunStepSucceeded(
        step.data.id,
        result.data ?? null
      );
      if (!stepSucceeded.success) {
        await markAutomationRunFailed(input.runId, stepSucceeded.error);
        return { success: false, error: stepSucceeded.error };
      }
    } catch (error) {
      const executionError = {
        code: "ACTION_EXECUTION_FAILED",
        message: error instanceof Error ? error.message : "动作执行失败",
      };
      await markAutomationRunStepFailed(step.data.id, executionError);
      await createSkippedAutomationRunSteps({
        runId: input.runId,
        branch,
        actions: actions.slice(index + 1),
      });
      await markAutomationRunFailed(input.runId, executionError);
      return { success: false, error: executionError };
    }
  }

  const completed = await markAutomationRunSucceeded(input.runId);
  if (!completed.success) {
    await markAutomationRunFailed(input.runId, completed.error);
    return { success: false, error: completed.error };
  }

  return { success: true, data: { runId: input.runId } };
}

export async function enqueueAutomationRun(
  input: EnqueueAutomationRunInput
): Promise<ServiceResult<{ id: string }>> {
  const run = await createAutomationRun(input);
  if (!run.success) {
    return run;
  }

  queue.push(async () => {
    try {
      const automation = await loadAutomationExecutionTarget(input);
      if (!automation.success) {
        await markAutomationRunFailed(run.data.id, automation.error);
        return;
      }

      await executeQueuedAutomationRun({
        runId: run.data.id,
        automation: automation.data,
        context: {
          automationId: automation.data.id,
          tableId: input.contextSnapshot.tableId,
          recordId: input.contextSnapshot.recordId,
          record: input.contextSnapshot.record,
          previousRecord: input.contextSnapshot.previousRecord,
          changedFields: input.contextSnapshot.changedFields,
          triggerSource: input.triggerSource,
          triggeredAt: input.contextSnapshot.triggeredAt,
          actor: input.contextSnapshot.actor,
        },
      });
    } catch (error) {
      await markAutomationRunFailed(run.data.id, {
        code: "DISPATCH_FAILED",
        message: error instanceof Error ? error.message : "自动化调度执行失败",
      });
    }
  });
  pumpQueue();

  return run;
}
