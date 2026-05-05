import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }

  const body = await request.json();
  const { action, ids } = body as {
    action: "delete" | "export";
    ids: string[];
  };

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "请选择至少一条记录" } }, { status: 400 });
  }

  const isAdmin = (session.user.role as Role) === "ADMIN";

  try {
    switch (action) {
      case "delete": {
        const where = isAdmin ? { id: { in: ids } } : { id: { in: ids }, userId: session.user.id };
        const result = await db.record.deleteMany({ where });
        return NextResponse.json({ success: true, data: { deleted: result.count } });
      }
      case "export": {
        const where = isAdmin ? { id: { in: ids } } : { id: { in: ids }, userId: session.user.id };
        const records = await db.record.findMany({
          where,
          include: { template: { select: { name: true } }, user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        });
        return NextResponse.json({ success: true, data: records });
      }
      default:
        return NextResponse.json({ error: { code: "INVALID_ACTION", message: "不支持的操作" } }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: { code: "BATCH_ERROR", message: error instanceof Error ? error.message : "批量操作失败" } },
      { status: 500 }
    );
  }
}
