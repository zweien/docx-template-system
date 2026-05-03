import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodError } from "zod";
import {
  updateAction,
  deleteAction,
} from "@/lib/services/editor-ai-action.service";
import { updateActionSchema } from "@/validators/editor-ai";

const ERROR_STATUS_MAP: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  BUILT_IN_PROTECTED: 400,
};

// PATCH /api/editor-ai/actions/[id] - Update an action
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateActionSchema.parse(body);
    const isAdmin = session.user.role === "ADMIN";
    const result = await updateAction(id, parsed, session.user.id, isAdmin);

    if (!result.success) {
      const status = ERROR_STATUS_MAP[result.error.code] ?? 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ success: true, data: result.data });
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
          message: error instanceof Error ? error.message : "更新动作失败",
        },
      },
      { status: 500 }
    );
  }
}

// DELETE /api/editor-ai/actions/[id] - Delete an action
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const isAdmin = session.user.role === "ADMIN";
    const result = await deleteAction(id, session.user.id, isAdmin);

    if (!result.success) {
      const status = ERROR_STATUS_MAP[result.error.code] ?? 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "删除动作失败",
        },
      },
      { status: 500 }
    );
  }
}
