import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id: tableId } = await params;
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("pageSize") ?? "50")));

  const [entries, total] = await Promise.all([
    db.dataRecordChangeHistory.findMany({
      where: { tableId },
      orderBy: { changedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        changedBy: { select: { name: true } },
      },
    }),
    db.dataRecordChangeHistory.count({ where: { tableId } }),
  ]);

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      recordId: e.recordId,
      fieldKey: e.fieldKey,
      fieldLabel: e.fieldLabel,
      oldValue: e.oldValue,
      newValue: e.newValue,
      changedById: e.changedById,
      changedByName: e.changedBy?.name ?? "",
      changedAt: e.changedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
