import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodError } from "zod";
import { testModelConnection, getDecryptedApiKeyAdmin } from "@/lib/services/agent2-model.service";
import { z } from "zod";

const testConnectionSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  modelId: z.string().min(1),
  modelIdOverride: z.string().min(1).optional(),
});

// POST /api/admin/agent2/models/test - Test model connection
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
    const parsed = testConnectionSchema.parse(body);

    // 如果没有提供 apiKey，尝试从已保存的模型配置中获取
    let apiKey = parsed.apiKey;
    if (!apiKey && parsed.modelId) {
      const keyResult = await getDecryptedApiKeyAdmin(parsed.modelId);
      if (keyResult.success) {
        apiKey = keyResult.data;
      }
    }

    // 使用 modelIdOverride（如果提供）或 fallback 到 modelId
    const actualModelId = parsed.modelIdOverride || parsed.modelId;

    const result = await testModelConnection({
      baseUrl: parsed.baseUrl,
      apiKey,
      modelId: actualModelId,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "连接成功" });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, message: "参数校验失败" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "测试连接失败",
      },
      { status: 500 }
    );
  }
}