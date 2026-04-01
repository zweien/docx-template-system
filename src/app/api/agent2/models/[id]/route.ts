import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteModel } from "@/lib/services/agent2-model.service";

interface RouteContext {
  params: Promise<{ id: string }>;
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
    const result = await deleteModel(id, session.user.id);
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
          message:
            error instanceof Error ? error.message : "删除模型配置失败",
        },
      },
      { status: 500 }
    );
  }
}
