import type { AutomationActionNode, AutomationExecutorParams } from "@/types/automation";
import type { ServiceResult } from "@/types/data-table";
import { executeAddCommentAction } from "@/lib/services/automation-action-executors/add-comment";
import { executeCallWebhookAction } from "@/lib/services/automation-action-executors/call-webhook";
import { executeCreateRecordAction } from "@/lib/services/automation-action-executors/create-record";
import { executeUpdateFieldAction } from "@/lib/services/automation-action-executors/update-field";

type AutomationActionExecutor = (
  params: AutomationExecutorParams
) => Promise<ServiceResult<unknown>>;

export function getAutomationActionExecutor(
  action: AutomationActionNode
): AutomationActionExecutor {
  switch (action.type) {
    case "update_field":
      return executeUpdateFieldAction as AutomationActionExecutor;
    case "create_record":
      return executeCreateRecordAction as AutomationActionExecutor;
    case "call_webhook":
      return executeCallWebhookAction as AutomationActionExecutor;
    case "add_comment":
      return executeAddCommentAction as AutomationActionExecutor;
  }
}
