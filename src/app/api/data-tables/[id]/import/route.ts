import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { getTable } from "@/lib/services/data-table.service";
import {
  validateImportData,
  importData,
} from "@/lib/services/import.service";
import { importSchema } from "@/validators/data-table";

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

    const config = importSchema.parse(JSON.parse(configStr));

    // Get table info
    const tableResult = await getTable(tableId);
    if (!tableResult.success) {
      return NextResponse.json(
        { error: tableResult.error.message },
        { status: 400 }
      );
    }

    const table = tableResult.data;

    // Parse Excel
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    if (jsonData.length === 0) {
      return NextResponse.json(
        { error: "Excel 文件没有数据" },
        { status: 400 }
      );
    }

    // Validate
    const validationResult = await validateImportData(
      tableId,
      jsonData,
      config.mapping,
      table.fields
    );

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.message },
        { status: 400 }
      );
    }

    if (!validationResult.data.valid) {
      return NextResponse.json(
        {
          error: "数据验证失败",
          errors: validationResult.data.errors.slice(0, 10), // Only show first 10 errors
        },
        { status: 400 }
      );
    }

    // Import
    const importResult = await importData(
      tableId,
      session.user.id,
      jsonData,
      config.mapping,
      config.options,
      table.fields
    );

    if (!importResult.success) {
      return NextResponse.json(
        { error: importResult.error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(importResult.data);
  } catch (error) {
    console.error("Import error:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "配置数据格式错误" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "导入失败" },
      { status: 500 }
    );
  }
}
