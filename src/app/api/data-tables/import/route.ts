import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { importTableFromJSON, importBundle } from "@/lib/services/import.service";
import type { ExportBundle } from "@/types/data-table";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "仅管理员可执行此操作" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "请上传文件" }, { status: 400 });
    }

    if (!file.name.endsWith(".json")) {
      return NextResponse.json({ error: "仅支持 .json 格式文件" }, { status: 400 });
    }

    const text = await file.text();
    let jsonData: Record<string, unknown>;
    try {
      jsonData = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "JSON 文件解析失败" }, { status: 400 });
    }

    // Detect version 2.0 bundle format
    if (jsonData.version === "2.0" && jsonData.tables && typeof jsonData.tables === "object") {
      const result = await importBundle(
        session.user.id,
        jsonData as unknown as ExportBundle
      );

      if (!result.success) {
        return NextResponse.json({ error: result.error.message }, { status: 400 });
      }

      return NextResponse.json(result.data, { status: 201 });
    }

    // Version 1.0 single-table import
    const result = await importTableFromJSON(
      session.user.id,
      jsonData as Parameters<typeof importTableFromJSON>[1]
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "导入数据表失败" }, { status: 500 });
  }
}
