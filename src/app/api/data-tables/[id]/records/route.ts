import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listRecords, createRecord } from "@/lib/services/data-record.service";
import { createRecordSchema } from "@/validators/data-table";
import type { FieldFilters } from "@/lib/services/data-record.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;

  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
  const search = searchParams.get("search") || undefined;

  // P2: 解析字段筛选参数
  // 格式: filters[field_key]=value 或 filters[field_key][op]=value
  const fieldFilters: FieldFilters = {};
  searchParams.forEach((value, key) => {
    // 匹配 filters[fieldKey] 或 filters[fieldKey][op]
    const match = key.match(/^filters\[([^\]]+)\](?:\[([^\]]+)\])?$/);
    if (match) {
      const fieldKey = match[1];
      const op = match[2]; // 可选的操作符

      if (op) {
        // filters[fieldKey][op]=value
        fieldFilters[fieldKey] = { op: op as FieldFilters[string]['op'], value };
      } else {
        // filters[fieldKey]=value (默认 eq)
        fieldFilters[fieldKey] = { value };
      }
    }
  });

  const result = await listRecords(id, {
    page,
    pageSize,
    search,
    fieldFilters: Object.keys(fieldFilters).length > 0 ? fieldFilters : undefined,
  });

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(result.data);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  // Only ADMIN can create records
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const validated = createRecordSchema.parse(body);

    const result = await createRecord(session.user.id, id, validated.data);

    if (!result.success) {
      if (result.error.code === "NOT_FOUND") {
        return NextResponse.json({ error: result.error.message }, { status: 404 });
      }
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
      { error: "创建记录失败" },
      { status: 500 }
    );
  }
}
