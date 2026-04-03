import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { importRelationDetails } from "@/lib/services/import.service";

const relationImportSchema = z.object({
  relationFieldKey: z.string(),
  sourceMapping: z.record(z.string(), z.string()),
  targetMapping: z.record(z.string(), z.string()),
  attributeMapping: z.record(z.string(), z.string()),
  sourceBusinessKeys: z.array(z.string()).min(1),
  targetBusinessKeys: z.array(z.string()).min(1),
  targetTableId: z.string(),
});

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

  const { id: tableId } = await params;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const configStr = formData.get("config") as string | null;

    if (!file || !configStr) {
      return NextResponse.json(
        { error: "缺少文件或配置信息" },
        { status: 400 }
      );
    }

    const config = relationImportSchema.parse(JSON.parse(configStr));

    // Parse Excel
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    if (jsonData.length === 0) {
      return NextResponse.json(
        { error: "Excel 文件没有数据" },
        { status: 400 }
      );
    }

    const result = await importRelationDetails({
      tableId,
      relationFieldKey: config.relationFieldKey,
      userId: session.user.id,
      rows: jsonData,
      sourceMapping: config.sourceMapping,
      targetMapping: config.targetMapping,
      attributeMapping: config.attributeMapping,
      sourceBusinessKeys: config.sourceBusinessKeys,
      targetBusinessKeys: config.targetBusinessKeys,
      targetTableId: config.targetTableId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Relation import error:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "配置数据格式错误" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "关系导入失败" },
      { status: 500 }
    );
  }
}
