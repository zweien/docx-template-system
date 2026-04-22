import type { AutomationExecutorParams, CallWebhookAction } from "@/types/automation";

export async function executeCallWebhookAction(
  params: AutomationExecutorParams<CallWebhookAction>
) {
  const response = await fetch(params.action.url, {
    method: params.action.method,
    headers: {
      "Content-Type": "application/json",
      ...(params.action.headers ?? {}),
    },
    body: JSON.stringify(params.action.body ?? params.context.record ?? {}),
  });

  if (!response.ok) {
    return {
      success: false as const,
      error: {
        code: "WEBHOOK_FAILED",
        message: `Webhook returned ${response.status}`,
      },
    };
  }

  return {
    success: true as const,
    data: { status: response.status },
  };
}
