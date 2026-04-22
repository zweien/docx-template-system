import {
  createAutomationRun,
  markAutomationRunFailed,
  markAutomationRunStarted,
  markAutomationRunSucceeded,
} from "@/lib/services/automation-run.service";
import type { EnqueueAutomationRunInput } from "@/types/automation";
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

async function executeQueuedRun(runId: string): Promise<void> {
  const started = await markAutomationRunStarted(runId);
  if (!started.success) {
    await markAutomationRunFailed(runId, {
      code: started.error.code,
      message: started.error.message,
    });
    return;
  }

  const completed = await markAutomationRunSucceeded(runId);
  if (!completed.success) {
    await markAutomationRunFailed(runId, {
      code: completed.error.code,
      message: completed.error.message,
    });
  }
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
      await executeQueuedRun(run.data.id);
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
