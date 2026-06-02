import * as nocodb from "@/lib/nocodb";
import type { AutomationExecutorParams, CreateRecordAction } from "@/types/automation";

export async function executeCreateRecordAction(
  params: AutomationExecutorParams<CreateRecordAction>
) {
  try {
    const result = await nocodb.createRecord(
      params.action.tableId,
      params.action.values
    );
    return { success: true as const, data: { id: String(result.id), ...result.data } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建记录失败";
    return { success: false as const, error: { code: "CREATE_FAILED", message } };
  }
}
