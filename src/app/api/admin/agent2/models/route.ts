import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodError } from "zod";
import {
  listGlobalModels,
  createGlobalModel,
  getEnvDefaultModels,
} from "@/lib/services/agent2-model.service";
import { createModelSchema } from "@/validators/agent2";

// GET /api/admin/agent2/models - List all global models
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
    const envModels = getEnvDefaultModels();
    const globalModelsResult = await listGlobalModels();

    if (!globalModelsResult.success) {
      return NextResponse.json({ error: globalModelsResult.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: [...envModels, ...globalModelsResult.data],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "加载模型列表失败",
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/admin/agent2/models - Create global model
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
    const parsed = createModelSchema.parse(body);
    const result = await createGlobalModel({
      name: parsed.name,
      providerId: parsed.providerId,
      modelId: parsed.modelId,
      baseUrl: parsed.baseUrl,
      apiKey: parsed.apiKey,
    });

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
          message: error instanceof Error ? error.message : "创建模型配置失败",
        },
      },
      { status: 500 }
    );
  }
}
