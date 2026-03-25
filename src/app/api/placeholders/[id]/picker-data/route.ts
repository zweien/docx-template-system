import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlaceholderById } from "@/lib/services/placeholder.service";
import { listRecords } from "@/lib/services/data-record.service";
import { recordQuerySchema } from "@/validators/data-table";
import { ZodError } from "zod";

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

  // 解析查询参数
  const { searchParams } = new URL(request.url);
  try {
    const query = recordQuerySchema.parse({
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") || "1",
      pageSize: searchParams.get("pageSize") || "10",
    });

    const result = await listRecords(placeholder.sourceTableId, {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({
      records: result.data.records,
      total: result.data.total,
      page: result.data.page,
      pageSize: result.data.pageSize,
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
