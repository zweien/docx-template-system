import { NextRequest, NextResponse } from "next/server";
import { getRouteSessionUser } from "@/lib/auth";
import { listRecords } from "@/lib/services/data-record.service";
import { getTable } from "@/lib/services/data-table.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const RELATION_OPTION_PAGE_SIZE = 100;
const MAX_RELATION_OPTION_COUNT = 100;

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

  const normalizedSearch = (search ?? "").trim().toLowerCase();
  const options: Array<{ id: string; label: string }> = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && options.length < MAX_RELATION_OPTION_COUNT) {
    const result = await listRecords(id, {
      page,
      pageSize: RELATION_OPTION_PAGE_SIZE,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: result.error.code === "NOT_FOUND" ? 404 : 400 }
      );
    }

    totalPages = result.data.totalPages ?? 1;

    for (const record of result.data.records) {
      const label = String(
        (displayField ? record.data[displayField] : null) ??
          record.id
      );
      const matchesSearch =
        !normalizedSearch ||
        label.toLowerCase().includes(normalizedSearch);

      if (
        matchesSearch &&
        options.length < MAX_RELATION_OPTION_COUNT
      ) {
        options.push({ id: record.id, label });
      }
    }

    page += 1;
  }

  return NextResponse.json(options);
}
