import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlaceholderById } from "@/lib/services/placeholder.service";
import { listRecords, getTableFields } from "@/lib/nocodb";
import { ZodError } from "zod";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;

  // 获取占位符信息
  const placeholder = await getPlaceholderById(id);
  if (!placeholder || !placeholder.sourceTableId) {
    return NextResponse.json({ error: "占位符未绑定数据表" }, { status: 400 });
  }

  const sourceTableId = placeholder.sourceTableId;

  // 解析查询参数
  const { searchParams } = new URL(request.url);
  try {
    const recordQuerySchema = z.object({
      search: z.string().optional(),
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().default(10),
    });
    const query = recordQuerySchema.parse({
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") || "1",
      pageSize: searchParams.get("pageSize") || "10",
    });

    // 并行获取记录和字段信息
    const [recordsResult, fields] = await Promise.all([
      listRecords(sourceTableId, {
        page: query.page,
        pageSize: query.pageSize,
        search: query.search,
      }),
      getTableFields(sourceTableId),
    ]);

    return NextResponse.json({
      fields: fields.map((f) => ({
        id: f.nocodbColumnId,
        key: f.key,
        label: f.label,
        type: f.type,
      })),
      records: recordsResult.records,
      total: recordsResult.total,
      page: recordsResult.page,
      pageSize: recordsResult.pageSize,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: `参数验证失败: ${error.issues.map((e) => e.message).join(", ")}` },
        { status: 400 }
      );
    }
    console.error("获取选择器数据失败:", error);
    return NextResponse.json({ error: "获取数据失败" }, { status: 500 });
  }
}
