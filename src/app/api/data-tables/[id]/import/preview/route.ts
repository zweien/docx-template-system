import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseExcel } from "@/lib/services/import.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "请上传文件" }, { status: 400 });
    }

    // Check file type
    if (!file.name.endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "请上传 .xlsx 格式的文件" },
        { status: 400 }
      );
    }

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "文件大小不能超过 5MB" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseExcel(buffer);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 }
      );
    }

    // Check row count
    if (result.data.totalRows > 1000) {
      return NextResponse.json(
        { error: "单次导入不能超过 1000 行" },
        { status: 400 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Preview error:", error);
    return NextResponse.json(
      { error: "解析文件失败" },
      { status: 500 }
    );
  }
}
