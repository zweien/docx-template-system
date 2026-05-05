import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import * as XLSX from "xlsx";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }

  const isAdmin = (session.user.role as Role) === "ADMIN";
  const statusParam = request.nextUrl.searchParams.get("status");

  try {
    const where: Record<string, unknown> = {};
    if (!isAdmin && session.user.id) {
      where.userId = session.user.id;
    }
    if (statusParam && ["PENDING", "COMPLETED", "FAILED"].includes(statusParam)) {
      where.status = statusParam;
    }

    const records = await db.record.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        template: { select: { name: true } },
        user: { select: { name: true } },
      },
    });

    const statusLabels: Record<string, string> = { PENDING: "待生成", COMPLETED: "已完成", FAILED: "失败" };

    const headers = ["模板名称", "文件名", "状态", "生成者", "生成时间"];
    const rows = records.map((r) => [
      r.template.name,
      r.fileName ?? "",
      statusLabels[r.status] ?? r.status,
      r.user.name,
      r.createdAt.toLocaleDateString("zh-CN"),
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length * 2, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "生成记录");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("生成记录.xlsx")}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "EXPORT_ERROR", message: error instanceof Error ? error.message : "导出失败" } },
      { status: 500 }
    );
  }
}
