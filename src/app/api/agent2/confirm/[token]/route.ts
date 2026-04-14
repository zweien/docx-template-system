import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodError } from "zod";
import { toolConfirmSchema } from "@/validators/agent2";
import {
  validateAndClaimToken,
  rejectToken,
} from "@/lib/agent2/confirm-store";
import { executeToolAction } from "@/lib/agent2/tool-executor";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const { token } = await params;
    const body = await request.json();
    const { approved, toolCallId } = toolConfirmSchema.parse(body);

    if (approved) {
      const claimResult = await validateAndClaimToken(token, session.user.id);
      if (!claimResult.success) {
        const status =
          claimResult.error.code === "EXPIRED" ? 410 : 409;
        return NextResponse.json(
          { error: claimResult.error },
          { status }
        );
      }

      const execResult = await executeToolAction(
        claimResult.data.toolName,
        claimResult.data.toolInput as Record<string, unknown>,
        session.user.id
      );

      if (!execResult.success) {
        return NextResponse.json(
          {
            error: {
              code: "EXECUTION_FAILED",
              message: execResult.error,
            },
          },
          { status: 500 }
        );
      }

      // Update the DB-stored assistant message to replace _needsConfirm with
      // a clear success message so the next AI continuation understands the tool was executed
      if (toolCallId) {
        try {
          // Search by conversationId + precise toolCallId for exact match
          const messages = await db.agent2Message.findMany({
            where: {
              conversationId: claimResult.data.conversationId,
              role: "assistant",
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          });

          for (const message of messages) {
            const parts = message.parts as Array<Record<string, unknown>>;
            let found = false;
            const updatedParts = parts.map((part) => {
              if (
                !found &&
                (part.type === "dynamic-tool" || (typeof part.type === "string" && part.type.startsWith("tool-"))) &&
                part.toolCallId === toolCallId &&
                part.output != null &&
                typeof part.output === "object" &&
                "_needsConfirm" in (part.output as Record<string, unknown>)
              ) {
                found = true;
                return {
                  ...part,
                  output: {
                    success: true,
                    message: `${claimResult.data.toolName} 已由用户确认并执行成功`,
                    data: execResult.data,
                  },
                };
              }
              return part;
            });

            if (found) {
              await db.agent2Message.update({
                where: { id: message.id },
                data: { parts: updatedParts as Prisma.InputJsonValue },
              });
              break;
            }
          }
        } catch {
          // Non-critical: if DB update fails, the client still has the result
        }
      }

      return NextResponse.json({ success: true, data: execResult.data });
    } else {
      const rejectResult = await rejectToken(token, session.user.id);
      if (!rejectResult.success) {
        return NextResponse.json(
          { error: rejectResult.error },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "参数校验失败" } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error ? error.message : "操作失败",
        },
      },
      { status: 500 }
    );
  }
}
