import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { importFromJSON } from "@/lib/services/import.service";
import { getTable } from "@/lib/services/data-table.service";
import { jsonImportOptionsSchema } from "@/validators/data-table";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  const { id: tableId } = await params;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const configStr = formData.get("config") as string | null;

  if (!file) {
    return NextResponse.json({ error: "未上传文件" }, { status: 400 });
  }

  if (!configStr) {
    return NextResponse.json({ error: "缺少导入配置" }, { status: 400 });
  }

  let config: { strategy: "skip" | "overwrite" };
  try {
    const parsed = JSON.parse(configStr);
    const validation = jsonImportOptionsSchema.safeParse(parsed);
    if (!validation.success) {
      return NextResponse.json(
        { error: "配置格式错误", details: validation.error.flatten() },
        { status: 400 }
      );
    }
    config = validation.data;
  } catch {
    return NextResponse.json({ error: "配置 JSON 解析失败" }, { status: 400 });
  }

  // Parse JSON file
  let jsonData: {
    version: string;
    fields: Array<{ key: string; label: string; type: string }>;
    records: Record<string, unknown>[];
  };
  try {
    const text = await file.text();
    jsonData = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "JSON 文件解析失败" }, { status: 400 });
  }

  // Get table fields
  const tableResult = await getTable(tableId);
  if (!tableResult.success) {
    return NextResponse.json(
      { error: tableResult.error.message },
      { status: 400 }
    );
  }

  const result = await importFromJSON(
    tableId,
    session.user.id,
    jsonData,
    config,
    tableResult.data.fields
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(result.data);
}
