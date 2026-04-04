import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { ViewType } from "@/generated/prisma/enums";
import type {
  DataViewItem,
  FilterCondition,
  ServiceResult,
  SortConfig,
} from "@/types/data-table";

// Helper to convert to Prisma JSON input
function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}

function normalizeSortBy(raw: unknown): SortConfig[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.filter(
      (item): item is SortConfig =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as SortConfig).fieldKey === "string" &&
        ((item as SortConfig).order === "asc" || (item as SortConfig).order === "desc")
    );
  }

  if (
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as SortConfig).fieldKey === "string" &&
    ((raw as SortConfig).order === "asc" || (raw as SortConfig).order === "desc")
  ) {
    return [raw as SortConfig];
  }

  return [];
}

function mapViewItem(row: {
  id: string;
  tableId: string;
  name: string;
  type: ViewType;
  isDefault: boolean;
  filters: unknown;
  sortBy: unknown;
  visibleFields: unknown;
  fieldOrder: unknown;
  groupBy: string | null;
  viewOptions: unknown;
  createdAt: Date;
  updatedAt: Date;
}): DataViewItem {
  return {
    id: row.id,
    tableId: row.tableId,
    name: row.name,
    type: row.type,
    isDefault: row.isDefault,
    filters: (row.filters as FilterCondition[]) ?? [],
    sortBy: normalizeSortBy(row.sortBy),
    visibleFields: (row.visibleFields as string[]) ?? [],
    fieldOrder: (row.fieldOrder as string[]) ?? [],
    groupBy: row.groupBy ?? null,
    viewOptions:
      typeof row.viewOptions === "object" && row.viewOptions !== null
        ? (row.viewOptions as Record<string, unknown>)
        : {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listViews(tableId: string): Promise<ServiceResult<DataViewItem[]>> {
  try {
    const views = await db.dataView.findMany({
      where: { tableId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    return { success: true, data: views.map(mapViewItem) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取视图列表失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

export async function getView(viewId: string): Promise<ServiceResult<DataViewItem>> {
  try {
    const view = await db.dataView.findUnique({ where: { id: viewId } });
    if (!view) {
      return { success: false, error: { code: "NOT_FOUND", message: "视图不存在" } };
    }
    return { success: true, data: mapViewItem(view) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取视图失败";
    return { success: false, error: { code: "GET_FAILED", message } };
  }
}

export async function createView(
  tableId: string,
  data: {
    name: string;
    type?: ViewType;
    isDefault?: boolean;
    filters?: FilterCondition[];
    sortBy?: SortConfig[] | null;
    visibleFields?: string[];
    fieldOrder?: string[];
    groupBy?: string | null;
    viewOptions?: Record<string, unknown>;
  }
): Promise<ServiceResult<DataViewItem>> {
  try {
    const view = await db.dataView.create({
      data: {
        tableId,
        name: data.name,
        type: data.type ?? ViewType.GRID,
        isDefault: data.isDefault ?? false,
        filters: toJsonValue(data.filters ?? []),
        sortBy:
          data.sortBy === null
            ? Prisma.JsonNull
            : toJsonValue(data.sortBy ?? []),
        visibleFields: toJsonValue(data.visibleFields ?? []),
        fieldOrder: toJsonValue(data.fieldOrder ?? []),
        groupBy: data.groupBy ?? null,
        viewOptions: toJsonValue(data.viewOptions ?? {}),
      },
    });
    return { success: true, data: mapViewItem(view) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建视图失败";
    if (message.includes("Unique")) {
      return { success: false, error: { code: "DUPLICATE", message: "视图名称已存在" } };
    }
    return { success: false, error: { code: "CREATE_FAILED", message } };
  }
}

export async function updateView(
  viewId: string,
  data: Partial<{
    name: string;
    type: ViewType;
    isDefault: boolean;
    filters: FilterCondition[];
    sortBy: SortConfig[] | null;
    visibleFields: string[];
    fieldOrder: string[];
    groupBy: string | null;
    viewOptions: Record<string, unknown>;
  }>
): Promise<ServiceResult<DataViewItem>> {
  try {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.filters !== undefined) updateData.filters = toJsonValue(data.filters);
    if (data.sortBy !== undefined) {
      updateData.sortBy =
        data.sortBy === null ? Prisma.JsonNull : toJsonValue(data.sortBy);
    }
    if (data.visibleFields !== undefined) updateData.visibleFields = toJsonValue(data.visibleFields);
    if (data.fieldOrder !== undefined) updateData.fieldOrder = toJsonValue(data.fieldOrder);
    if (data.groupBy !== undefined) updateData.groupBy = data.groupBy;
    if (data.viewOptions !== undefined) updateData.viewOptions = toJsonValue(data.viewOptions);

    const view = await db.dataView.update({
      where: { id: viewId },
      data: updateData,
    });
    return { success: true, data: mapViewItem(view) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新视图失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}

export async function deleteView(viewId: string): Promise<ServiceResult<null>> {
  try {
    await db.dataView.delete({ where: { id: viewId } });
    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除视图失败";
    return { success: false, error: { code: "DELETE_FAILED", message } };
  }
}
