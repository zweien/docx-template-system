import { db } from "@/lib/db";
import type { DataViewItem, FilterCondition, SortConfig, ServiceResult } from "@/types/data-table";

function mapViewItem(row: {
  id: string;
  tableId: string;
  name: string;
  isDefault: boolean;
  filters: unknown;
  sortBy: unknown;
  visibleFields: unknown;
  fieldOrder: unknown;
  createdAt: Date;
  updatedAt: Date;
}): DataViewItem {
  return {
    id: row.id,
    tableId: row.tableId,
    name: row.name,
    isDefault: row.isDefault,
    filters: (row.filters as FilterCondition[]) ?? [],
    sortBy: row.sortBy as SortConfig | null,
    visibleFields: (row.visibleFields as string[]) ?? [],
    fieldOrder: (row.fieldOrder as string[]) ?? [],
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
    isDefault?: boolean;
    filters?: FilterCondition[];
    sortBy?: SortConfig | null;
    visibleFields?: string[];
    fieldOrder?: string[];
  }
): Promise<ServiceResult<DataViewItem>> {
  try {
    const view = await db.dataView.create({
      data: {
        tableId,
        name: data.name,
        isDefault: data.isDefault ?? false,
        filters: data.filters ?? [],
        sortBy: data.sortBy ?? null,
        visibleFields: data.visibleFields ?? [],
        fieldOrder: data.fieldOrder ?? [],
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
    isDefault: boolean;
    filters: FilterCondition[];
    sortBy: SortConfig | null;
    visibleFields: string[];
    fieldOrder: string[];
  }>
): Promise<ServiceResult<DataViewItem>> {
  try {
    const view = await db.dataView.update({
      where: { id: viewId },
      data,
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
