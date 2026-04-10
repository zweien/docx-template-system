import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodError } from "zod";
import {
  updateMcpServer,
  deleteMcpServer,
} from "@/lib/services/agent2-mcp.service";
import { updateMcpServerSchema } from "@/validators/agent2";

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

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "需要管理员权限" } },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateMcpServerSchema.parse(body);
    const result = await updateMcpServer(id, {
      name: parsed.name,
      description: parsed.description,
      enabled: parsed.enabled,
      config: parsed.config,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
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
          message:
            error instanceof Error
              ? error.message
              : "更新 MCP 服务器失败",
        },
      },
      { status: 500 }
    );
  }
}

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

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "需要管理员权限" } },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const result = await deleteMcpServer(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "删除 MCP 服务器失败",
        },
      },
      { status: 500 }
    );
  }
}
