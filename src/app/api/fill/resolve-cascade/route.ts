import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRecord, getTableFields } from "@/lib/nocodb";

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

  try {
    const body = await request.json();
    const validated = resolveCascadeSchema.parse(body);
    const { templateId, sourceTableId, recordId } = validated;

    // 1. 获取模板所有占位符绑定信息（本地数据库）
    const placeholders = await db.placeholder.findMany({
      where: { templateId },
      select: {
        key: true,
        sourceTableId: true,
        sourceField: true,
      },
    });

    // 2. 从 NocoDB 获取选中的记录数据
    let recordData: Record<string, unknown>;
    try {
      const record = await getRecord(sourceTableId, recordId);
      recordData = record.data;
    } catch {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }

    // 3. 从 NocoDB 获取源表字段定义，用于识别 RELATION 类型字段
    const fields = await getTableFields(sourceTableId);
    const fieldDefs = new Map(fields.map((f) => [f.key, f]));

    // 4. 收集所有需要解析的关联字段 ID
    const relationIdsByTable: Map<string, Set<string>> = new Map();

    for (const ph of placeholders) {
      if (ph.sourceTableId === sourceTableId && ph.sourceField) {
        const fieldDef = fieldDefs.get(ph.sourceField);
        if (fieldDef?.type === "RELATION" && fieldDef.relationTargetTableId) {
          const rawValue = recordData?.[ph.sourceField];
          // NocoDB relation fields come as arrays of IDs or objects
          const relIds = extractRelationIds(rawValue);

          if (relIds.length > 0) {
            if (!relationIdsByTable.has(fieldDef.relationTargetTableId)) {
              relationIdsByTable.set(fieldDef.relationTargetTableId, new Set());
            }
            for (const relId of relIds) {
              relationIdsByTable.get(fieldDef.relationTargetTableId)!.add(relId);
            }
          }
        }
      }
    }

    // 5. 获取关联记录的显示值（逐个获取，NocoDB 无批量 by-id API）
    const relatedRecordsMap: Map<string, Record<string, unknown>> = new Map();
    for (const [targetTableId, ids] of relationIdsByTable) {
      for (const relId of ids) {
        try {
          const relatedRecord = await getRecord(targetTableId, relId);
          relatedRecordsMap.set(relId, relatedRecord.data);
        } catch {
          // 关联记录可能已被删除，跳过
        }
      }
    }

    // 6. 构建返回数据
    const result: Record<string, unknown> = {};

    for (const ph of placeholders) {
      if (ph.sourceTableId === sourceTableId && ph.sourceField) {
        const fieldDef = fieldDefs.get(ph.sourceField);
        const rawValue = recordData?.[ph.sourceField];

        if (fieldDef?.type === "RELATION" && fieldDef.relationTargetTableId) {
          // RELATION 类型字段：解析显示值
          const relIds = extractRelationIds(rawValue);
          if (relIds.length > 0) {
            // For SINGLE relation, use the first linked record's display value
            // Display value is the first non-system field value as a reasonable default
            const relId = relIds[0];
            const relatedData = relatedRecordsMap.get(relId);
            result[ph.key] = relatedData ? getDisplayValue(relatedData, fields) : relId;
          } else {
            result[ph.key] = "";
          }
        } else {
          // 非 RELATION 类型字段：直接取值
          result[ph.key] = rawValue ?? "";
        }
      }
    }

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

/**
 * Extract relation IDs from a NocoDB relation field value.
 * NocoDB stores relations as arrays of strings (IDs) or objects with Id/Id-like keys.
 */
function extractRelationIds(rawValue: unknown): string[] {
  if (Array.isArray(rawValue)) {
    return rawValue
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item !== null) {
          // NocoDB nested objects may have Id, id, or similar keys
          const obj = item as Record<string, unknown>;
          return String(obj.Id ?? obj.id ?? "");
        }
        return "";
      })
      .filter(Boolean);
  }
  if (typeof rawValue === "string" && rawValue) {
    return [rawValue];
  }
  return [];
}

/**
 * Get a reasonable display value from a record.
 * Tries to find a "title" or "name" field, falls back to the first field value.
 */
function getDisplayValue(
  relatedData: Record<string, unknown>,
  _sourceFields: { key: string; label: string; type: string }[]
): string {
  // Prefer title/name-like fields, then first non-empty value
  const priorityKeys = ["title", "name", "Title", "Name"];
  for (const key of priorityKeys) {
    if (relatedData[key] !== undefined && relatedData[key] !== null) {
      return String(relatedData[key]);
    }
  }
  const entries = Object.entries(relatedData);
  for (const [, value] of entries) {
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}
