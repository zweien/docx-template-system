import { updateRecord } from "@/lib/services/data-record.service";
import type { UpdateFieldAction, AutomationExecutorParams } from "@/types/automation";

function resolveRecordId(params: AutomationExecutorParams<UpdateFieldAction>): string | null {
  if (params.context.recordId) {
    return params.context.recordId;
  }

  const recordId = params.context.record?.id;
  return typeof recordId === "string" ? recordId : null;
}

export async function executeUpdateFieldAction(
  params: AutomationExecutorParams<UpdateFieldAction>
) {
  const recordId = resolveRecordId(params);
  if (!recordId) {
    return {
      success: false as const,
      error: { code: "RECORD_REQUIRED", message: "当前动作需要记录上下文" },
    };
  }

  return updateRecord(
    recordId,
    {
      [params.action.fieldKey]: params.action.value,
    },
    params.context.actor?.id ?? "system"
  );
}
