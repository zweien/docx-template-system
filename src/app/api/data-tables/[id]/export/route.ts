import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exportToExcel } from "@/lib/services/export.service";
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

  // Get table name for filename
  const tableResult = await getTable(tableId);
  if (!tableResult.success) {
    return NextResponse.json(
      { error: tableResult.error.message },
      { status: 400 }
    );
  }

  const table = tableResult.data;
  const { searchParams } = new URL(_request.url);
  const visibleFields = searchParams.getAll("visibleField");
  const fieldOrder = searchParams.getAll("fieldOrder");
  const selectedIds = searchParams.getAll("selectedId");
  const result = await exportToExcel(tableId, {
    visibleFields: visibleFields.length > 0 ? visibleFields : undefined,
    fieldOrder: fieldOrder.length > 0 ? fieldOrder : undefined,
  }, selectedIds.length > 0 ? selectedIds : undefined);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  const filename = `${table.name}_${new Date().toISOString().split("T")[0]}.xlsx`;

  return new NextResponse(new Uint8Array(result.data), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
    },
  });
}
