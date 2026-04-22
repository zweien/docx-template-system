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

    // 3. 获取源表的字段定义，用于识别 RELATION 类型字段
    const sourceTable = await db.dataTable.findUnique({
      where: { id: sourceTableId },
      select: {
        fields: {
          select: {
            key: true,
            type: true,
            relationTo: true,
            displayField: true,
          },
        },
      },
    });

    const fieldDefs = new Map(
      sourceTable?.fields.map((f) => [f.key, f]) ?? []
    );

    // 4. 收集所有需要解析的关联字段 ID
    const relationIdsByTable: Map<string, Set<string>> = new Map();
    const relationFieldKeys: string[] = [];

    for (const ph of placeholders) {
      if (ph.sourceTableId === sourceTableId && ph.sourceField) {
        const fieldDef = fieldDefs.get(ph.sourceField);
        if (fieldDef?.type === "RELATION" && fieldDef.relationTo) {
          const rawValue = (record.data as Record<string, unknown>)?.[ph.sourceField];
          // Handle both string ID and object { id, display } formats
          const relId = typeof rawValue === "string"
            ? rawValue
            : (rawValue as Record<string, unknown>)?.id;

          if (typeof relId === "string" && relId) {
            if (!relationIdsByTable.has(fieldDef.relationTo)) {
              relationIdsByTable.set(fieldDef.relationTo, new Set());
            }
            relationIdsByTable.get(fieldDef.relationTo)!.add(relId);
            relationFieldKeys.push(ph.key);
          }
        }
      }
    }

    // 5. 批量获取关联记录的显示值
    const relatedRecordsMap: Map<string, Record<string, unknown>> = new Map();
    for (const [_tableId, ids] of relationIdsByTable) {
      if (ids.size > 0) {
        const relatedRecords = await db.dataRecord.findMany({
          where: { id: { in: Array.from(ids) } },
        });
        for (const rel of relatedRecords) {
          relatedRecordsMap.set(rel.id, rel.data as Record<string, unknown>);
        }
      }
    }

    // 6. 构建返回数据
    const result: Record<string, unknown> = {};

    for (const ph of placeholders) {
      if (ph.sourceTableId === sourceTableId && ph.sourceField) {
        const fieldDef = fieldDefs.get(ph.sourceField);
        const rawValue = (record.data as Record<string, unknown>)?.[ph.sourceField];

        if (fieldDef?.type === "RELATION" && fieldDef.relationTo && fieldDef.displayField) {
          // RELATION 类型字段：解析显示值
          const relId = typeof rawValue === "string"
            ? rawValue
            : (rawValue as Record<string, unknown>)?.id;

          if (typeof relId === "string" && relId) {
            const relatedData = relatedRecordsMap.get(relId);
            result[ph.key] = relatedData?.[fieldDef.displayField] ?? relId;
          } else {
            result[ph.key] = "";
          }
        } else {
          // 非 RELATION 类型字段：直接取值
          result[ph.key] = rawValue ?? "";
        }
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
