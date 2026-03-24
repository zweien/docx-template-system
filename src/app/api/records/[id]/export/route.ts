import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { exportRecordToExcel } from "@/lib/services/export.service";

// ── GET /api/records/[id]/export ──

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  const { id } = await params;

  const record = await db.record.findUnique({
    where: { id },
    include: {
      template: {
        select: {
          name: true,
          placeholders: { select: { key: true, label: true }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!record) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "记录不存在" } },
      { status: 404 }
    );
  }

  // Verify ownership or admin
  if (record.userId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "无权操作此记录" } },
      { status: 403 }
    );
  }

  const formData = record.formData as Record<string, unknown>;
  const buffer = exportRecordToExcel(
    formData,
    record.template.placeholders,
    record.template.name
  );

  const filename = `${record.template.name}_表单数据.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
