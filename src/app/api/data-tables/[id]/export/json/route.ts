import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exportToJSON } from "@/lib/services/export.service";
import { getTable } from "@/lib/services/data-table.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id: tableId } = await params;

  const tableResult = await getTable(tableId);
  if (!tableResult.success) {
    return NextResponse.json(
      { error: tableResult.error.message },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(_request.url);
  const selectedIds = searchParams.getAll("selectedId");
  const result = await exportToJSON(tableId, selectedIds.length > 0 ? selectedIds : undefined);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  const filename = `${tableResult.data.name}_${new Date().toISOString().split("T")[0]}.json`;

  return new NextResponse(JSON.stringify(result.data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
