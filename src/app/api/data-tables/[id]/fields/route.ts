import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateFields, getTable } from "@/lib/services/data-table.service";
import { backfillCountFieldValues } from "@/lib/services/data-relation.service";
import { updateFieldsSchema } from "@/validators/data-table";
import { logAudit } from "@/lib/services/audit-log.service";
import { getClientIp, getUserAgent } from "@/lib/request-utils";
import { ZodError } from "zod";
import { FieldType } from "@/generated/prisma/enums";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: Get fields for a data table
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;

  const result = await getTable(id);

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  // Return only the fields array
  return NextResponse.json(result.data.fields);
}

// PUT: Batch update fields (full replace)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  // Only ADMIN can update fields
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const validated = updateFieldsSchema.parse(body);

    // Fetch existing table info for audit diff
    const existingTable = await getTable(id);
    const existingFields = existingTable.success ? existingTable.data.fields : [];
    const existingFieldIds = new Set(existingFields.map((f) => f.id));
    const tableName = existingTable.success ? existingTable.data.name : id;

    const result = await updateFields(id, validated.fields, validated.businessKeys);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 }
      );
    }

    // Audit log
    const addedFields = validated.fields.filter(
      (f) => f.id && !existingFieldIds.has(f.id)
    );
    const removedFields = existingFields.filter(
      (f) => !validated.fields.some((nf) => nf.id === f.id)
    );
    const updatedFields = validated.fields.filter(
      (f) => f.id && existingFieldIds.has(f.id)
    );

    await logAudit({
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      action: "DATA_TABLE_FIELD_UPDATE",
      targetType: "DataTable",
      targetId: id,
      targetName: tableName,
      detail: {
        addedFields: addedFields.map((f) => ({ key: f.key, label: f.label, type: f.type })),
        removedFields: removedFields.map((f) => ({ key: f.key, label: f.label, type: f.type })),
        updatedFieldKeys: updatedFields.map((f) => f.key),
        totalFields: validated.fields.length,
        businessKeys: validated.businessKeys,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    // Backfill COUNT field values for newly added COUNT fields
    const hasNewCountFields = addedFields.some((f) => f.type === FieldType.COUNT);
    if (hasNewCountFields) {
      backfillCountFieldValues(id).catch((err) => {
        console.error("COUNT 字段回填失败:", err);
      });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof ZodError) {
      const errorMessages = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        { error: `数据验证失败: ${errorMessages}` },
        { status: 400 }
      );
    }
    console.error("更新字段配置失败:", error);
    return NextResponse.json(
      { error: "更新字段配置失败" },
      { status: 500 }
    );
  }
}
