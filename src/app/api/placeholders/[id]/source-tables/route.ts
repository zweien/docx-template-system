import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listTables as nocodbListTables, getTableDetail } from "@/lib/nocodb";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  // Note: placeholder id is reserved for future use (filtering available tables based on placeholder context)
  const { id: _placeholderId } = await params;

  try {
    // 获取 NocoDB 数据表列表
    const tables = await nocodbListTables();

    // 为每个表获取完整信息（包含字段）
    const tablesWithFields = await Promise.all(
      tables.map(async (t) => {
        try {
          const detail = await getTableDetail(t.id);
          return {
            id: detail.id,
            name: detail.name,
            fields: detail.fields,
          };
        } catch (error) {
          console.error(`获取数据表字段失败: ${t.id}`, error);
          return {
            id: t.id,
            name: t.name,
            fields: [],
          };
        }
      })
    );

    return NextResponse.json(tablesWithFields);
  } catch (error) {
    console.error("获取数据表列表失败:", error);
    return NextResponse.json({ error: "获取数据表列表失败" }, { status: 500 });
  }
}
