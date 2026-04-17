import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRecord, updateRecord, deleteRecord, patchField } from "@/lib/services/data-record.service";
import { updateRecordSchema, patchFieldSchema } from "@/validators/data-table";
import { logAudit } from "@/lib/services/audit-log.service";
import { getClientIp, getUserAgent } from "@/lib/request-utils";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string; recordId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { recordId } = await params;
  const result = await getRecord(recordId);

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(result.data);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  // Only ADMIN can update records
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { recordId } = await params;

  try {
    const body = await request.json();
    const validated = updateRecordSchema.parse(body);

    // Fetch old data before update
    const oldRecord = await db.dataRecord.findUnique({
      where: { id: recordId },
      select: {
        tableId: true,
        data: true,
        table: { select: { name: true, fields: { select: { key: true, label: true } } } },
      },
    });

    const result = await updateRecord(recordId, validated.data, session.user.id);

    if (!result.success) {
      if (result.error.code === "NOT_FOUND") {
        return NextResponse.json({ error: result.error.message }, { status: 404 });
      }
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 }
      );
    }

    // Build field-level change detail
    const oldData = (oldRecord?.data ?? {}) as Record<string, unknown>;
    const fieldLabels = Object.fromEntries(
      (oldRecord?.table?.fields ?? []).map((f) => [f.key, f.label])
    );
    const changes: Record<string, { label: string; oldValue: unknown; newValue: unknown }> = {};
    for (const [key, newValue] of Object.entries(validated.data)) {
      const oldValue = oldData[key];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = {
          label: fieldLabels[key] ?? key,
          oldValue: oldValue ?? "",
          newValue,
        };
      }
    }

    await logAudit({
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      action: "DATA_RECORD_UPDATE",
      targetType: "DataRecord",
      targetId: recordId,
      targetName: oldRecord?.table?.name ?? recordId,
      detail: { tableId: oldRecord?.tableId, changes },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "数据验证失败", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "更新记录失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  // Only ADMIN can delete records
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { recordId } = await params;

  // Fetch record info before deletion for audit log
  const record = await db.dataRecord.findUnique({
    where: { id: recordId },
    select: {
      tableId: true,
      data: true,
      table: { select: { name: true, fields: { select: { key: true, label: true } } } },
    },
  });

  const result = await deleteRecord(recordId, session.user.id);

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  // Build detail with deleted record data
  const fieldLabels = Object.fromEntries(
    (record?.table?.fields ?? []).map((f) => [f.key, f.label])
  );
  const deletedData = (record?.data ?? {}) as Record<string, unknown>;
  const fields: Record<string, { label: string; value: unknown }> = {};
  for (const [key, value] of Object.entries(deletedData)) {
    fields[key] = { label: fieldLabels[key] ?? key, value };
  }

  await logAudit({
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    action: "DATA_RECORD_DELETE",
    targetType: "DataRecord",
    targetId: recordId,
    targetName: record?.table?.name ?? recordId,
    detail: { tableId: record?.tableId, fields },
    ipAddress: getClientIp(_request),
    userAgent: getUserAgent(_request),
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  // Only ADMIN can patch fields
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { recordId } = await params;

  try {
    const body = await request.json();
    const validated = patchFieldSchema.parse(body);

    // Fetch old data before patch
    const oldRecord = await db.dataRecord.findUnique({
      where: { id: recordId },
      select: {
        tableId: true,
        data: true,
        table: { select: { name: true, fields: { select: { key: true, label: true } } } },
      },
    });
    const oldData = (oldRecord?.data ?? {}) as Record<string, unknown>;
    const fieldLabel = oldRecord?.table?.fields?.find((f) => f.key === validated.fieldKey)?.label ?? validated.fieldKey;

    const result = await patchField(recordId, validated.fieldKey, validated.value, session.user.id);

    if (!result.success) {
      if (result.error.code === "NOT_FOUND") {
        return NextResponse.json({ error: result.error.message }, { status: 404 });
      }
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 }
      );
    }

    await logAudit({
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      action: "DATA_RECORD_UPDATE",
      targetType: "DataRecord",
      targetId: recordId,
      targetName: oldRecord?.table?.name ?? recordId,
      detail: {
        tableId: oldRecord?.tableId,
        changes: {
          [validated.fieldKey]: {
            label: fieldLabel,
            oldValue: oldData[validated.fieldKey] ?? "",
            newValue: validated.value,
          },
        },
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "数据验证失败", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "更新字段失败" },
      { status: 500 }
    );
  }
}
