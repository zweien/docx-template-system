import * as nocodb from "@/lib/nocodb";
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

  try {
    const result = await nocodb.updateRecord(
      params.context.tableId,
      recordId,
      {
        [params.action.fieldKey]: params.action.value,
      }
    );
    return { success: true as const, data: { id: String(result.id) } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新记录失败";
    return { success: false as const, error: { code: "UPDATE_FAILED", message } };
  }
}
