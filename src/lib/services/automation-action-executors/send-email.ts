import { sendEmail } from "@/lib/services/email.service";
import { renderAutomationTemplate } from "@/lib/services/automation-template.service";
import type { AutomationExecutorParams, SendEmailAction } from "@/types/automation";

export async function executeSendEmailAction(
  params: AutomationExecutorParams<SendEmailAction>
) {
  const to = renderAutomationTemplate(params.action.to, params.context).trim();
  const subject = renderAutomationTemplate(params.action.subject, params.context).trim();
  const body = renderAutomationTemplate(params.action.body, params.context).trim();

  if (!to) {
    return {
      success: false as const,
      error: {
        code: "EMAIL_RECIPIENT_REQUIRED",
        message: "邮件收件人不能为空",
      },
    };
  }

  if (!subject) {
    return {
      success: false as const,
      error: {
        code: "EMAIL_SUBJECT_REQUIRED",
        message: "邮件主题不能为空",
      },
    };
  }

  if (!body) {
    return {
      success: false as const,
      error: {
        code: "EMAIL_BODY_REQUIRED",
        message: "邮件内容不能为空",
      },
    };
  }

  return sendEmail({
    to,
    subject,
    text: body,
  });
}
