import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodError } from "zod";
import {
  listMcpServers,
  createMcpServer,
} from "@/lib/services/agent2-mcp.service";
import { createMcpServerSchema } from "@/validators/agent2";

export async function GET() {
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
    const result = await listMcpServers();
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
              : "加载 MCP 服务器列表失败",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const parsed = createMcpServerSchema.parse(body);
    const result = await createMcpServer({
      name: parsed.name,
      description: parsed.description,
      transportType: parsed.transportType,
      config: parsed.config,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201 }
    );
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
              : "创建 MCP 服务器失败",
        },
      },
      { status: 500 }
    );
  }
}
