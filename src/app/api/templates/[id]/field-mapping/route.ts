// src/app/api/templates/[id]/field-mapping/route.ts

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFieldMappingInfo } from "@/lib/services/batch-generation.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const dataTableId = searchParams.get("dataTableId");

  if (!dataTableId) {
    return NextResponse.json({ error: "缺少 dataTableId 参数" }, { status: 400 });
  }

  const result = await getFieldMappingInfo(id, dataTableId);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.code === "TEMPLATE_NOT_FOUND" ? 404 : 400 }
    );
  }

  return NextResponse.json(result.data);
}
