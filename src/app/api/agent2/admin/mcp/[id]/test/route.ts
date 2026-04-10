import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDecryptedMcpServer } from "@/lib/services/agent2-mcp.service";
import { testMcpConnection } from "@/lib/agent2/mcp-client";

export async function POST(
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

    // 获取解密后的服务器配置
    const serverResult = await getDecryptedMcpServer(id);
    if (!serverResult.success) {
      return NextResponse.json({ error: serverResult.error }, { status: 400 });
    }

    const server = serverResult.data;

    // 测试连接，使用配置中的 timeout 或默认 5000ms
    const timeout =
      typeof server.config.timeout === "number"
        ? (server.config.timeout as number)
        : 5000;

    const testResult = await testMcpConnection(
      {
        name: server.name,
        transportType: server.transportType,
        config: server.config,
      },
      timeout
    );

    if (!testResult.success) {
      return NextResponse.json(
        { success: false, error: testResult.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { tools: testResult.tools },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "测试 MCP 服务器连接失败",
        },
      },
      { status: 500 }
    );
  }
}
