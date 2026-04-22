import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  deleteAutomation,
  getAutomation,
  updateAutomation,
} from "@/lib/services/automation.service";
import { updateAutomationSchema } from "@/validators/automation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function getErrorStatus(code: string): number {
  return code === "NOT_FOUND" ? 404 : 400;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未授权" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const result = await getAutomation(id, session.user.id);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: getErrorStatus(result.error.code) }
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未授权" } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateAutomationSchema.parse(body);

    const result = await updateAutomation(id, session.user.id, parsed);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: getErrorStatus(result.error.code) }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "参数校验失败" } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "更新自动化失败" } },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未授权" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const result = await deleteAutomation(id, session.user.id);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: getErrorStatus(result.error.code) }
    );
  }

  return NextResponse.json({ success: true, data: null });
}
