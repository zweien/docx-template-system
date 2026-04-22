import cron from "node-cron";
import { db } from "@/lib/db";
import { enqueueAutomationRun } from "@/lib/services/automation-dispatcher.service";
import type { AutomationDefinition, AutomationExecutionTarget } from "@/types/automation";
import type { ServiceResult } from "@/types/data-table";

function mapAutomationTarget(row: {
  id: string;
  tableId: string;
  definition: unknown;
}): AutomationExecutionTarget {
  return {
    id: row.id,
    tableId: row.tableId,
    definition: row.definition as AutomationDefinition,
  };
}

function isScheduleDue(definition: AutomationDefinition, now: Date): boolean {
  if (definition.trigger.type !== "schedule") {
    return false;
  }

  const [hour, minute] = definition.trigger.schedule.time.split(":").map(Number);
  if (now.getHours() !== hour || now.getMinutes() !== minute) {
    return false;
  }

  switch (definition.trigger.schedule.mode) {
    case "daily":
      return true;
    case "weekly":
      return now.getDay() === definition.trigger.schedule.weekday;
    case "monthly":
      return now.getDate() === definition.trigger.schedule.dayOfMonth;
  }
}

export async function dispatchScheduledAutomations(): Promise<ServiceResult<{ queued: number }>> {
  try {
    const rows = await db.automation.findMany({
      where: {
        enabled: true,
        triggerType: "schedule",
      },
      select: {
        id: true,
        tableId: true,
        definition: true,
      },
    });

    const now = new Date();
    let queued = 0;
    for (const row of rows) {
      const automation = mapAutomationTarget(row);
      if (!isScheduleDue(automation.definition, now)) {
        continue;
      }

      const result = await enqueueAutomationRun({
        automationId: automation.id,
        automation,
        triggerSource: "SCHEDULE",
        triggerPayload: {
          scheduledAt: now.toISOString(),
        },
        contextSnapshot: {
          tableId: automation.tableId,
          recordId: null,
          record: null,
          previousRecord: null,
          changedFields: [],
          triggeredAt: now.toISOString(),
          actor: null,
        },
      });

      if (result.success) {
        queued += 1;
      }
    }

    return { success: true, data: { queued } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "调度自动化失败";
    return { success: false, error: { code: "DISPATCH_SCHEDULED_FAILED", message } };
  }
}

export function registerAutomationScheduler(): void {
  cron.schedule("* * * * *", async () => {
    const result = await dispatchScheduledAutomations();
    if (!result.success) {
      console.error("[automation] scheduler dispatch failed:", result.error.message);
    }
  });
}
