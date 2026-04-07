import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodError } from "zod";
import { testModelConnection, getDecryptedApiKey } from "@/lib/services/agent2-model.service";
import { z } from "zod";

const testConnectionSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  modelId: z.string().min(1),
});

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
    const parsed = testConnectionSchema.parse(body);

    // 如果没有提供 apiKey，尝试从已保存的模型配置中获取
    let apiKey = parsed.apiKey;
    if (!apiKey) {
      const keyResult = await getDecryptedApiKey(parsed.modelId, session.user.id);
      if (keyResult.success) {
        apiKey = keyResult.data;
      }
    }

    const result = await testModelConnection({
      baseUrl: parsed.baseUrl,
      apiKey,
      modelId: parsed.modelId,
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