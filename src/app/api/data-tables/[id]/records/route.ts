import { NextRequest, NextResponse } from "next/server";
import { getRouteSessionUser } from "@/lib/auth";
import { listRecords, createRecord } from "@/lib/services/data-record.service";
import {
  createRecordSchema,
  filterConditionSchema,
  sortConfigSchema,
} from "@/validators/data-table";
import type { FieldFilters } from "@/lib/services/data-record.service";
import type { SortConfig, FilterCondition, FilterGroup } from "@/types/data-table";
import { normalizeFilters } from "@/types/data-table";
import { logAudit } from "@/lib/services/audit-log.service";
import { getClientIp, getUserAgent } from "@/lib/request-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getRouteSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;

  const hasPage = searchParams.has("page") || searchParams.has("pageSize");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "10000", 10);
  const search = searchParams.get("search") || undefined;

  // P2: 解析字段筛选参数
  // 格式: filters[field_key]=value 或 filters[field_key][op]=value
  const fieldFilters: FieldFilters = {};
  searchParams.forEach((value, key) => {
    // 匹配 filters[fieldKey] 或 filters[fieldKey][op]
    const match = key.match(/^filters\[([^\]]+)\](?:\[([^\]]+)\])?$/);
    if (match) {
      const fieldKey = match[1];
      const op = match[2]; // 可选的操作符

      if (op) {
        // filters[fieldKey][op]=value
        fieldFilters[fieldKey] = { op: op as FieldFilters[string]['op'], value };
      } else {
        // filters[fieldKey]=value (默认 eq)
        fieldFilters[fieldKey] = { value };
      }
    }
  });

  // View-level parameters
  const viewId = searchParams.get("viewId") || undefined;
  let viewFilters: FilterGroup[] | FilterCondition[] | undefined;
  let viewSortBy: SortConfig[] | null | undefined;

  if (viewId) {
    const { getView } = await import("@/lib/services/data-view.service");
    const viewResult = await getView(viewId);
    if (viewResult.success) {
      viewFilters = viewResult.data.filters.length > 0 ? viewResult.data.filters : undefined;
      viewSortBy =
        viewResult.data.sortBy.length > 0 ? viewResult.data.sortBy : undefined;
    }
  }

  // Temporary params (override view config)
  const sortByParam = searchParams.get("sortBy");
  if (sortByParam) {
    try {
      viewSortBy = zodParseSortBy(sortByParam);
    } catch { /* ignore */ }
  }

  const filterConditionsParam = searchParams.get("filterConditions");
  if (filterConditionsParam) {
    try {
      const parsed = JSON.parse(filterConditionsParam);
      // Support both FilterGroup[] and legacy FilterCondition[] formats
      if (Array.isArray(parsed) && parsed.length > 0 && "conditions" in parsed[0]) {
        // New FilterGroup[] format
        viewFilters = parsed as FilterGroup[];
      } else {
        // Legacy FilterCondition[] format — normalize to FilterGroup[]
        viewFilters = filterConditionSchema.array().parse(parsed);
      }
    } catch { /* ignore */ }
  }

  const result = await listRecords(id, {
    page,
    pageSize,
    search,
    fieldFilters: Object.keys(fieldFilters).length > 0 ? fieldFilters : undefined,
    sortBy: viewSortBy,
    filterConditions: viewFilters,
  });

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(result.data);
}

function zodParseSortBy(sortByParam: string): SortConfig[] {
  return sortConfigSchema.array().parse(JSON.parse(sortByParam));
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getRouteSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  // Only ADMIN can create records
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const validated = createRecordSchema.parse(body);

    const result = await createRecord(user.id, id, validated.data, {
      skipRequiredValidation: validated.skipRequiredValidation,
    });

    if (!result.success) {
      if (result.error.code === "NOT_FOUND") {
        return NextResponse.json({ error: result.error.message }, { status: 404 });
      }
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 }
      );
    }

    await logAudit({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: "DATA_RECORD_CREATE",
      targetType: "DataRecord",
      targetId: result.data.id,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "数据验证失败", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "创建记录失败" },
      { status: 500 }
    );
  }
}
