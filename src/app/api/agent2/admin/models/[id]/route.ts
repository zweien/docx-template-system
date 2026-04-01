import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodError } from "zod";
import {
  updateGlobalModel,
  deleteGlobalModel,
} from "@/lib/services/agent2-model.service";
import { updateModelSchema } from "@/validators/agent2";

interface RouteContext {
  params: Promise<{ id: string }>;
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

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "需要管理员权限" } },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = updateModelSchema.parse(body);
    const { id } = await params;
    const result = await updateGlobalModel(id, {
      name: parsed.name,
      baseUrl: parsed.baseUrl,
      apiKey: parsed.apiKey,
      modelId: parsed.modelId,
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
          message:
            error instanceof Error
              ? error.message
              : "更新全局模型配置失败",
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

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "需要管理员权限" } },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const result = await deleteGlobalModel(id);
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
            error instanceof Error
              ? error.message
              : "删除全局模型配置失败",
        },
      },
      { status: 500 }
    );
  }
}
