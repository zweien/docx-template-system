import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodError } from "zod";
import {
  getConversation,
  updateConversation,
  deleteConversation,
} from "@/lib/services/agent2-conversation.service";
import { updateConversationSchema } from "@/validators/agent2";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
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
    const { id } = await params;
    const result = await getConversation(id, session.user.id);
    if (!result.success) {
      const status = result.error.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "获取会话失败",
        },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const body = await request.json();
    const parsed = updateConversationSchema.parse(body);
    const { id } = await params;
    const result = await updateConversation(id, session.user.id, {
      title: parsed.title,
      isFavorite: parsed.isFavorite,
    });

    if (!result.success) {
      const status = result.error.code === "NOT_FOUND" ? 404 : 400;
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
          message: error instanceof Error ? error.message : "更新会话失败",
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
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
    const { id } = await params;
    const result = await deleteConversation(id, session.user.id);
    if (!result.success) {
      const status = result.error.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "删除会话失败",
        },
      },
      { status: 500 }
    );
  }
}
