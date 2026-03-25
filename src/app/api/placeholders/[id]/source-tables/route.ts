import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listTables, getTable } from "@/lib/services/data-table.service";

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

  // 获取数据表列表
  const listResult = await listTables();

  if (!listResult.success) {
    return NextResponse.json({ error: listResult.error.message }, { status: 500 });
  }

  // 为每个表获取完整信息（包含字段）
  const tablesWithFields = await Promise.all(
    listResult.data.map(async (t) => {
      const detailResult = await getTable(t.id);
      if (!detailResult.success) {
        console.error(`获取数据表字段失败: ${t.id}`, detailResult.error.message);
      }
      return {
        id: t.id,
        name: t.name,
        fields: detailResult.success ? detailResult.data.fields : [],
      };
    })
  );

  return NextResponse.json(tablesWithFields);
}
