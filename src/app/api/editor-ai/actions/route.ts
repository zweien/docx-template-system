import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodError } from "zod";
import {
  listAvailableActions,
  listAllActions,
  createUserAction,
  createGlobalAction,
} from "@/lib/services/editor-ai-action.service";
import { createActionSchema } from "@/validators/editor-ai";

// GET /api/editor-ai/actions - List actions (admin: all global actions; user: available actions)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const isAdmin = session.user.role === "ADMIN";

    if (isAdmin && searchParams.get("admin") === "true") {
      const result = await listAllActions();
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, data: result.data });
    }

    const result = await listAvailableActions(session.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "加载动作列表失败",
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/editor-ai/actions - Create action (admin: global; user: personal)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createActionSchema.parse(body);
    const isAdmin = session.user.role === "ADMIN";

    const { searchParams } = new URL(request.url);
    const isGlobal = isAdmin && searchParams.get("admin") === "true";

    if (isGlobal) {
      const result = await createGlobalAction(parsed);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, data: result.data }, { status: 201 });
    }

    const result = await createUserAction(session.user.id, parsed);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
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
          message: error instanceof Error ? error.message : "创建动作失败",
        },
      },
      { status: 500 }
    );
  }
}
