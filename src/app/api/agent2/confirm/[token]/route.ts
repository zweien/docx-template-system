import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodError } from "zod";
import { toolConfirmSchema } from "@/validators/agent2";
import {
  validateAndClaimToken,
  rejectToken,
} from "@/lib/agent2/confirm-store";
import { executeToolAction } from "@/lib/agent2/tool-executor";

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
    const { approved } = toolConfirmSchema.parse(body);

    if (approved) {
      const claimResult = await validateAndClaimToken(token);
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

      return NextResponse.json({ success: true, data: execResult.data });
    } else {
      const rejectResult = await rejectToken(token);
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
