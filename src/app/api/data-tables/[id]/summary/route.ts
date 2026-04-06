import { NextRequest, NextResponse } from "next/server";
import { getRouteSessionUser } from "@/lib/auth";
import { computeSummary } from "@/lib/services/data-record.service";
import type { AggregateType, FilterGroup } from "@/types/data-table";
import { normalizeFilters } from "@/types/data-table";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getRouteSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;
  const aggregationsParam = request.nextUrl.searchParams.get("aggregations");
  const filterConditionsParam = request.nextUrl.searchParams.get("filterConditions");
  const search = request.nextUrl.searchParams.get("search") || undefined;

  let aggregations: Record<string, AggregateType> = {};
  try {
    aggregations = aggregationsParam ? JSON.parse(aggregationsParam) : {};
  } catch { /* ignore */ }

  let filterConditions: FilterGroup[] | undefined;
  if (filterConditionsParam) {
    try {
      filterConditions = normalizeFilters(JSON.parse(filterConditionsParam));
    } catch { /* ignore */ }
  }

  const result = await computeSummary(id, filterConditions, search, aggregations);

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json(result.data);
}
