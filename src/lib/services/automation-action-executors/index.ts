import type { AutomationActionNode } from "@/types/automation";
import { executeAddCommentAction } from "@/lib/services/automation-action-executors/add-comment";
import { executeCallWebhookAction } from "@/lib/services/automation-action-executors/call-webhook";
import { executeCreateRecordAction } from "@/lib/services/automation-action-executors/create-record";
import { executeUpdateFieldAction } from "@/lib/services/automation-action-executors/update-field";

export function getAutomationActionExecutor(action: AutomationActionNode) {
  switch (action.type) {
    case "update_field":
      return executeUpdateFieldAction;
    case "create_record":
      return executeCreateRecordAction;
    case "call_webhook":
      return executeCallWebhookAction;
    case "add_comment":
      return executeAddCommentAction;
  }
}
