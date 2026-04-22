import { createRecord } from "@/lib/services/data-record.service";
import type { AutomationExecutorParams, CreateRecordAction } from "@/types/automation";

export async function executeCreateRecordAction(
  params: AutomationExecutorParams<CreateRecordAction>
) {
  return createRecord(
    params.context.actor?.id ?? "system",
    params.action.tableId,
    params.action.values
  );
}
