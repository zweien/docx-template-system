import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const resolveCascadeSchema = z.object({
  templateId: z.string().min(1, "模板ID不能为空"),
  sourceTableId: z.string().min(1, "数据表ID不能为空"),
  recordId: z.string().min(1, "记录ID不能为空"),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  // TODO: Phase 2 - 添加模板访问权限验证
  // 当前 Phase 1 允许所有登录用户访问，后续需要验证用户是否有权限访问该模板

  try {
    const body = await request.json();
    const validated = resolveCascadeSchema.parse(body);
    const { templateId, sourceTableId, recordId } = validated;

    // 1. 获取模板所有占位符绑定信息
    const placeholders = await db.placeholder.findMany({
      where: { templateId },
      select: {
        key: true,
        sourceTableId: true,
        sourceField: true,
      },
    });

    // 2. 获取选中的记录数据
    const record = await db.dataRecord.findUnique({
      where: { id: recordId },
      select: { data: true },
    });

    if (!record) {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }

    // 3. 构建返回数据
    const result: Record<string, unknown> = {};

    for (const ph of placeholders) {
      if (ph.sourceTableId === sourceTableId && ph.sourceField) {
        // 同表直接取值
        result[ph.key] = (record.data as Record<string, unknown>)?.[ph.sourceField] ?? "";
      }
    }

    // Phase 1 只实现同表自动填充，关联字段级联查询在 Phase 2 实现

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: `参数验证失败: ${error.issues.map((e) => e.message).join(", ")}` },
        { status: 400 }
      );
    }
    console.error("解析级联数据失败:", error);
    return NextResponse.json({ error: "解析级联数据失败" }, { status: 500 });
  }
}
