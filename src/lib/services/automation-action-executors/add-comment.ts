import { createComment } from "@/lib/services/data-record-comment.service";
import type { AddCommentAction, AutomationExecutorParams } from "@/types/automation";

function resolveRecordId(params: AutomationExecutorParams<AddCommentAction>): string | null {
  if (params.context.recordId) {
    return params.context.recordId;
  }

  const recordId = params.context.record?.id;
  return typeof recordId === "string" ? recordId : null;
}

export async function executeAddCommentAction(
  params: AutomationExecutorParams<AddCommentAction>
) {
  const recordId = resolveRecordId(params);
  if (!recordId) {
    return {
      success: false as const,
      error: { code: "RECORD_REQUIRED", message: "当前动作需要记录上下文" },
    };
  }

  return createComment(params.context.actor?.id ?? "system", {
    recordId,
    content: params.action.content,
  });
}
