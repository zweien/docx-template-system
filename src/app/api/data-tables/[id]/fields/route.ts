import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateFields } from "@/lib/services/data-table.service";
import { updateFieldsSchema } from "@/validators/data-table";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT: Batch update fields (full replace)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  // Only ADMIN can update fields
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const validated = updateFieldsSchema.parse(body);

    const result = await updateFields(id, validated.fields);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "数据验证失败", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "更新字段配置失败" },
      { status: 500 }
    );
  }
}
