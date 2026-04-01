// src/lib/agent2/confirm-store.ts
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { randomUUID } from "crypto";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

const CONFIRM_REQUIRED_TOOLS = new Set([
  "createRecord",
  "updateRecord",
  "deleteRecord",
  "generateDocument",
  "executeCode",
]);

const RISK_MESSAGES: Record<string, string> = {
  createRecord: "此操作将创建新记录",
  updateRecord: "此操作将修改已有记录数据",
  deleteRecord: "此操作将永久删除记录，不可恢复",
  generateDocument: "此操作将使用模板生成文档",
  executeCode: "此操作将在沙箱中执行代码",
};

export function needsConfirm(toolName: string): boolean {
  return CONFIRM_REQUIRED_TOOLS.has(toolName);
}

export function getRiskMessage(toolName: string): string {
  return RISK_MESSAGES[toolName] || "此操作需要确认";
}

export async function createConfirmToken(
  conversationId: string,
  messageId: string,
  toolName: string,
  toolInput: unknown
): Promise<ServiceResult<string>> {
  try {
    const token = randomUUID();

    await db.agent2ToolConfirm.create({
      data: {
        conversationId,
        messageId,
        toolName,
        toolInput: toolInput as Prisma.InputJsonValue,
        token,
        status: "pending",
      },
    });

    return { success: true, data: token };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "创建确认令牌失败";
    return { success: false, error: { code: "CREATE_TOKEN_FAILED", message } };
  }
}

export async function validateAndClaimToken(
  token: string
): Promise<
  ServiceResult<{
    id: string;
    conversationId: string;
    messageId: string;
    toolName: string;
    toolInput: unknown;
  }>
> {
  try {
    const record = await db.agent2ToolConfirm.findUnique({
      where: { token },
    });

    if (!record) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "确认令牌不存在" },
      };
    }

    if (record.status !== "pending") {
      return {
        success: false,
        error: {
          code: "ALREADY_USED",
          message:
            record.status === "confirmed"
              ? "该确认令牌已被使用"
              : "该确认令牌已被拒绝",
        },
      };
    }

    // Check 5-minute expiry
    const expiresAt = new Date(record.createdAt.getTime() + 5 * 60 * 1000);
    if (new Date() > expiresAt) {
      return {
        success: false,
        error: { code: "EXPIRED", message: "确认令牌已过期（5分钟）" },
      };
    }

    // Atomically claim
    const updated = await db.agent2ToolConfirm.update({
      where: { id: record.id },
      data: {
        status: "confirmed",
        confirmedAt: new Date(),
      },
    });

    return {
      success: true,
      data: {
        id: updated.id,
        conversationId: updated.conversationId,
        messageId: updated.messageId,
        toolName: updated.toolName,
        toolInput: updated.toolInput,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "验证确认令牌失败";
    return { success: false, error: { code: "VALIDATE_FAILED", message } };
  }
}

export async function rejectToken(
  token: string
): Promise<ServiceResult<void>> {
  try {
    const record = await db.agent2ToolConfirm.findUnique({
      where: { token },
    });

    if (!record) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "确认令牌不存在" },
      };
    }

    if (record.status !== "pending") {
      return {
        success: false,
        error: { code: "ALREADY_USED", message: "该确认令牌已非待处理状态" },
      };
    }

    await db.agent2ToolConfirm.update({
      where: { id: record.id },
      data: { status: "rejected" },
    });

    return { success: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "拒绝确认令牌失败";
    return { success: false, error: { code: "REJECT_FAILED", message } };
  }
}

export async function cleanupExpiredTokens(): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  await db.agent2ToolConfirm.deleteMany({
    where: {
      status: "pending",
      createdAt: { lt: oneHourAgo },
    },
  });
}
