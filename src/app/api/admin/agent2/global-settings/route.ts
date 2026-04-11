import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodError } from "zod";
import {
  getGlobalSettings,
  updateGlobalSettings,
} from "@/lib/services/agent2-global-settings.service";
import { updateGlobalSettingsSchema } from "@/validators/agent2";

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
    const result = await getGlobalSettings();
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "加载全局设置失败",
        },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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
    const parsed = updateGlobalSettingsSchema.parse(body);
    const result = await updateGlobalSettings({
      ...parsed,
      backupConfig: parsed.backupConfig
        ? { enabled: parsed.backupConfig.enabled ?? false, schedule: parsed.backupConfig.schedule ?? "daily" }
        : undefined,
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
          message: error instanceof Error ? error.message : "更新全局设置失败",
        },
      },
      { status: 500 }
    );
  }
}
