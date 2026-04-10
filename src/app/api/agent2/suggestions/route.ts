import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGlobalSettings } from "@/lib/services/agent2-global-settings.service";

const DEFAULT_SUGGESTIONS = [
  "帮我查看系统中有哪些数据表",
  "搜索销售记录中金额大于1000的记录",
  "帮我生成一份月度销售统计图表",
  "查看可用的文档模板",
];

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const result = await getGlobalSettings();
    const suggestions =
      result.success && result.data.suggestions.length > 0
        ? result.data.suggestions
        : DEFAULT_SUGGESTIONS;

    return NextResponse.json({ success: true, data: suggestions });
  } catch {
    return NextResponse.json({ success: true, data: DEFAULT_SUGGESTIONS });
  }
}
