// src/app/api/templates/[id]/batch/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateBatch } from "@/lib/services/batch-generation.service";
import { batchGenerationInputSchema } from "@/validators/batch-generation";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id: templateId } = await params;

  // Check permission: ADMIN or template owner
  const template = await db.template.findUnique({
    where: { id: templateId },
    select: { createdById: true, status: true },
  });

  if (!template) {
    return NextResponse.json({ error: "模板不存在" }, { status: 404 });
  }

  const isAdmin = (session.user.role as Role) === "ADMIN";
  const isOwner = template.createdById === session.user.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  if (template.status !== "READY") {
    return NextResponse.json({ error: "模板未就绪" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const validated = batchGenerationInputSchema.parse({
      ...body,
      templateId,
    });

    const result = await generateBatch(session.user.id, validated);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "数据验证失败", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "批量生成失败" },
      { status: 500 }
    );
  }
}
