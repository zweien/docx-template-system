import { db } from "@/lib/db";
import { enqueueAutomationRun } from "@/lib/services/automation-dispatcher.service";
import type {
  AutomationDefinition,
  AutomationExecutionTarget,
  AutomationTrigger,
} from "@/types/automation";
import type { ServiceResult } from "@/types/data-table";

interface DispatchAutomationEventInput {
  tableId: string;
  triggerType: "record_created" | "record_updated" | "record_deleted";
  recordId?: string | null;
  record: Record<string, unknown> | null;
  previousRecord: Record<string, unknown> | null;
  changedFields: string[];
  actorId?: string | null;
}

function isSameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function matchesEventTrigger(
  trigger: AutomationTrigger,
  event: DispatchAutomationEventInput
): boolean {
  switch (trigger.type) {
    case "record_created":
      return event.triggerType === "record_created";
    case "record_updated":
      return event.triggerType === "record_updated" &&
        (!trigger.fieldKeys?.length ||
          trigger.fieldKeys.some((fieldKey) => event.changedFields.includes(fieldKey)));
    case "record_deleted":
      return event.triggerType === "record_deleted";
    case "field_changed":
      if (event.triggerType !== "record_updated") {
        return false;
      }
      if (!event.changedFields.includes(trigger.fieldKey)) {
        return false;
      }

      const previousValue = event.previousRecord?.[trigger.fieldKey];
      const currentValue = event.record?.[trigger.fieldKey];
      if (trigger.from !== undefined && !isSameValue(previousValue, trigger.from)) {
        return false;
      }
      if (trigger.to !== undefined && !isSameValue(currentValue, trigger.to)) {
        return false;
      }
      return true;
    case "schedule":
    case "manual":
      return false;
  }
}

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

export async function dispatchAutomationEvent(
  input: DispatchAutomationEventInput
): Promise<ServiceResult<{ queued: number }>> {
  try {
    const rows = await db.automation.findMany({
      where: {
        tableId: input.tableId,
        enabled: true,
        triggerType: {
          in:
            input.triggerType === "record_updated"
              ? ["record_updated", "field_changed"]
              : [input.triggerType],
        },
      },
      select: {
        id: true,
        tableId: true,
        definition: true,
      },
    });

    let queued = 0;
    const triggeredAt = new Date().toISOString();
    for (const row of rows) {
      const automation = mapAutomationTarget(row);
      if (!matchesEventTrigger(automation.definition.trigger, input)) {
        continue;
      }

      const result = await enqueueAutomationRun({
        automationId: automation.id,
        automation,
        triggerSource: "EVENT",
        triggerPayload: {
          triggerType: input.triggerType,
          recordId: input.recordId ?? null,
          changedFields: input.changedFields,
        },
        contextSnapshot: {
          tableId: input.tableId,
          recordId: input.recordId ?? null,
          record: input.record,
          previousRecord: input.previousRecord,
          changedFields: input.changedFields,
          triggeredAt,
          actor: input.actorId ? { id: input.actorId } : null,
        },
      });

      if (result.success) {
        queued += 1;
      }
    }

    return { success: true, data: { queued } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "分发自动化事件失败";
    return { success: false, error: { code: "DISPATCH_EVENT_FAILED", message } };
  }
}

export async function triggerAutomationManually(params: {
  automationId: string;
  userId: string;
  recordId?: string;
  payload?: Record<string, unknown>;
}): Promise<ServiceResult<{ runId: string }>> {
  try {
    const automation = await db.automation.findFirst({
      where: {
        id: params.automationId,
        createdById: params.userId,
      },
      select: {
        id: true,
        tableId: true,
        definition: true,
      },
    });

    if (!automation) {
      return { success: false, error: { code: "NOT_FOUND", message: "自动化不存在" } };
    }

    let record: Record<string, unknown> | null = null;
    if (params.recordId) {
      const recordRow = await db.dataRecord.findFirst({
        where: {
          id: params.recordId,
          tableId: automation.tableId,
        },
        select: {
          data: true,
        },
      });
      if (!recordRow) {
        return { success: false, error: { code: "NOT_FOUND", message: "记录不存在" } };
      }
      record = recordRow.data as Record<string, unknown>;
    }

    const result = await enqueueAutomationRun({
      automationId: automation.id,
      automation: mapAutomationTarget(automation),
      triggerSource: "MANUAL",
      triggerPayload: params.payload ?? {},
      contextSnapshot: {
        tableId: automation.tableId,
        recordId: params.recordId ?? null,
        record,
        previousRecord: null,
        changedFields: [],
        triggeredAt: new Date().toISOString(),
        actor: { id: params.userId },
      },
    });

    if (!result.success) {
      return result;
    }

    return { success: true, data: { runId: result.data.id } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "手动触发自动化失败";
    return { success: false, error: { code: "TRIGGER_MANUAL_FAILED", message } };
  }
}
