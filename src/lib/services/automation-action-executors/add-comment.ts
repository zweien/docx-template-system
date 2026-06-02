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

  // NocoDB 评论功能暂不支持通过自动化触发
  // TODO: 实现 NocoDB 评论 API 对接
  return {
    success: true as const,
    data: {
      recordId,
      content: params.action.content,
      skipped: true,
      reason: "评论功能暂未迁移到 NocoDB",
    },
  };
}
