import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  createAutomation,
  listAutomations,
} from "@/lib/services/automation.service";
import { createAutomationSchema } from "@/validators/automation";

const createAutomationRequestSchema = createAutomationSchema.extend({
  tableId: z.string().trim().min(1, "数据表 ID 不能为空"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未授权" } },
      { status: 401 }
    );
  }

  const result = await listAutomations(session.user.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: result.data });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未授权" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createAutomationRequestSchema.parse(body);

    const result = await createAutomation({
      tableId: parsed.tableId,
      userId: session.user.id,
      input: {
        name: parsed.name,
        description: parsed.description,
        enabled: parsed.enabled,
        triggerType: parsed.triggerType,
        definition: parsed.definition,
      },
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "参数校验失败" } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "创建自动化失败" } },
      { status: 500 }
    );
  }
}
