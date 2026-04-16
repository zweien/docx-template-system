import { NextRequest, NextResponse } from "next/server";
import { getRouteSessionUser } from "@/lib/auth";
import { listRecords } from "@/lib/services/data-record.service";
import { getTable } from "@/lib/services/data-table.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function resolveDisplayFieldKey(
  fields: Array<{ key: string; type: string }>,
  displayFieldParam?: string
): string | undefined {
  if (displayFieldParam && displayFieldParam !== "id") {
    return displayFieldParam;
  }

  return (
    fields.find(
      (field) =>
        field.type !== "RELATION" &&
        field.type !== "RELATION_SUBTABLE"
    )?.key ??
    fields[0]?.key
  );
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

  const displayField = resolveDisplayFieldKey(
    tableResult.data.fields,
    displayFieldParam
  );

  const result = await listRecords(id, {
    page: 1,
    pageSize: search ? 50 : 500,
    search: search || undefined,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.code === "NOT_FOUND" ? 404 : 400 }
    );
  }

  const options = result.data.records
    .map((record) => ({
      id: record.id,
      label: String(
        (displayField ? record.data[displayField] : null) ??
          record.id
      ),
    }))
    .filter((option) => {
      if (!search) return true;
      // Client-side filter as fallback for non-text fields
      return option.label.toLowerCase().includes(search.toLowerCase());
    });

  return NextResponse.json(options);
}
