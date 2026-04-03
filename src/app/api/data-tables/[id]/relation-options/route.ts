import { NextRequest, NextResponse } from "next/server";
import { getRouteSessionUser } from "@/lib/auth";
import { listRecords } from "@/lib/services/data-record.service";
import { getTable } from "@/lib/services/data-table.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getRouteSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;
  const search = request.nextUrl.searchParams.get("search") || undefined;
  const displayFieldParam =
    request.nextUrl.searchParams.get("displayField") || undefined;

  const tableResult = await getTable(id);
  if (!tableResult.success) {
    return NextResponse.json(
      { error: tableResult.error.message },
      { status: tableResult.error.code === "NOT_FOUND" ? 404 : 400 }
    );
  }

  const fallbackField = tableResult.data.fields.find(
    (field) =>
      field.type !== "RELATION" &&
      field.type !== "RELATION_SUBTABLE"
  );
  const displayField =
    displayFieldParam && displayFieldParam !== "id"
      ? displayFieldParam
      : fallbackField?.key;

  const result = await listRecords(id, {
    page: 1,
    pageSize: 20,
    search,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.code === "NOT_FOUND" ? 404 : 400 }
    );
  }

  const options = result.data.records.map((record) => ({
    id: record.id,
    label: String(
      (displayField ? record.data[displayField] : null) ??
        record.id
    ),
  }));

  return NextResponse.json(options);
}
