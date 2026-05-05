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

  try {
    const where = isAdmin ? {} : { status: "PUBLISHED" as const };

    const templates = await db.template.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        name: true,
        status: true,
        createdAt: true,
        createdBy: { select: { name: true } },
        category: { select: { name: true } },
        tags: { select: { tag: { select: { name: true } } } },
      },
    });

    const statusLabels: Record<string, string> = { DRAFT: "草稿", PUBLISHED: "已发布", ARCHIVED: "已归档" };

    const headers = ["模板名称", "状态", "分类", "标签", "创建者", "创建时间"];
    const rows = templates.map((t) => [
      t.name,
      statusLabels[t.status] ?? t.status,
      t.category?.name ?? "",
      t.tags.map((tg) => tg.tag.name).join(", "),
      t.createdBy.name,
      t.createdAt.toLocaleDateString("zh-CN"),
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length * 2, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "模板列表");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("模板列表.xlsx")}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "EXPORT_ERROR", message: error instanceof Error ? error.message : "导出失败" } },
      { status: 500 }
    );
  }
}
