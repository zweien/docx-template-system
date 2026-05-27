import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exportBundle } from "@/lib/services/export.service";
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

  const result = await exportBundle(tableId);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  const filename = `${tableResult.data.name}_bundle_${new Date().toISOString().split("T")[0]}.zip`;

  return new NextResponse(result.data as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
