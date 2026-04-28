import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import * as reportTemplateService from "@/modules/reports/services/report-template.service";

const updatePromptsSchema = z.object({
  prompts: z.array(
    z.object({
      target: z.string(),
      prompt: z.string(),
      mode: z.string(),
      level: z.string(),
    })
  ),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = updatePromptsSchema.parse(await request.json());
    const result = await reportTemplateService.updateTemplatePrompts(id, session.user.id, body.prompts);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Error && "issues" in e) {
      return NextResponse.json({ error: { code: "VALIDATION", message: "参数校验失败" } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Internal error" } }, { status: 500 });
  }
}
