import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodError } from "zod";
import { updateGlobalModel, deleteGlobalModel } from "@/lib/services/agent2-model.service";
import { z } from "zod";

const updateModelSchema = z.object({
  name: z.string().min(1).optional(),
  modelId: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  extraParams: z.record(z.string(), z.unknown()).optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/admin/agent2/models/[id] - Get single model
export async function GET(
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
    const { id } = await params;
    const { listGlobalModels } = await import("@/lib/services/agent2-model.service");
    const result = await listGlobalModels();

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const model = result.data.find((m) => m.id === id);
    if (!model) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "模型配置不存在" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: model });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "获取模型配置失败",
        },
      },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/agent2/models/[id] - Update global model
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
    const { id } = await params;
    const body = await request.json();
    const parsed = updateModelSchema.parse(body);

    const result = await updateGlobalModel(id, parsed);

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
          message: error instanceof Error ? error.message : "更新模型配置失败",
        },
      },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/agent2/models/[id] - Delete global model
export async function DELETE(
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
    const { id } = await params;
    const result = await deleteGlobalModel(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "删除模型配置失败",
        },
      },
      { status: 500 }
    );
  }
}
