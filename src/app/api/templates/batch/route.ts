import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import { TemplateStatus } from "@/generated/prisma/enums";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }

  const isAdmin = (session.user.role as Role) === "ADMIN";
  if (!isAdmin) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "仅管理员可执行批量操作" } }, { status: 403 });
  }

  const body = await request.json();
  const { action, ids, payload } = body as {
    action: "delete" | "updateStatus" | "updateCategory";
    ids: string[];
    payload?: { status?: string; categoryId?: string | null };
  };

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "请选择至少一条记录" } }, { status: 400 });
  }

  try {
    switch (action) {
      case "delete": {
        await db.template.deleteMany({ where: { id: { in: ids } } });
        return NextResponse.json({ success: true, data: { deleted: ids.length } });
      }
      case "updateStatus": {
        if (!payload?.status || !Object.values(TemplateStatus).includes(payload.status as TemplateStatus)) {
          return NextResponse.json({ error: { code: "INVALID_INPUT", message: "无效的状态值" } }, { status: 400 });
        }
        await db.template.updateMany({
          where: { id: { in: ids } },
          data: { status: payload.status as TemplateStatus },
        });
        return NextResponse.json({ success: true, data: { updated: ids.length } });
      }
      case "updateCategory": {
        await db.template.updateMany({
          where: { id: { in: ids } },
          data: { categoryId: payload?.categoryId === "__none__" ? null : (payload?.categoryId ?? null) },
        });
        return NextResponse.json({ success: true, data: { updated: ids.length } });
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
