import nodemailer from "nodemailer";
import type { ServiceResult } from "@/types/data-table";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
let transporterKey: string | null = null;

function readSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const portValue = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim();

  if (!host || !portValue || !user || !pass || !from) {
    return null;
  }

  const port = Number(portValue);
  if (!Number.isInteger(port) || port <= 0) {
    return null;
  }

  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
  };
}

function getTransporter(config: SmtpConfig) {
  const nextKey = JSON.stringify(config);
  if (transporter && transporterKey === nextKey) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
  transporterKey = nextKey;

  return transporter;
}

function textToHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .join("<br />");
}

export function isEmailConfigured(): boolean {
  return readSmtpConfig() !== null;
}

export async function sendEmail(input: SendEmailInput): Promise<ServiceResult<{ messageId: string }>> {
  const config = readSmtpConfig();
  if (!config) {
    return {
      success: false,
      error: {
        code: "EMAIL_NOT_CONFIGURED",
        message: "邮件服务未配置，请设置 SMTP_HOST、SMTP_PORT、SMTP_USER、SMTP_PASS、SMTP_FROM",
      },
    };
  }

  try {
    const mailer = getTransporter(config);
    const result = await mailer.sendMail({
      from: config.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: textToHtml(input.text),
    });

    return {
      success: true,
      data: {
        messageId: result.messageId,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "发送邮件失败";
    return {
      success: false,
      error: {
        code: "EMAIL_SEND_FAILED",
        message,
      },
    };
  }
}
