import { db } from "@/lib/db";
import type {
  FilterCondition,
  SortConfig,
  SearchResult,
  AggregateResult,
  TableSchema,
  ServiceResult,
} from "./types";
import type { DataTableListItem } from "@/types/data-table";

// 列出可访问的表
export async function listTables(): Promise<ServiceResult<DataTableListItem[]>> {
  try {
    const tables = await db.dataTable.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { fields: true, records: true },
        },
      },
    });

    return {
      success: true,
      data: tables.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        fieldCount: t._count.fields,
        recordCount: t._count.records,
        createdAt: t.createdAt,
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取数据表列表失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

// 获取表结构
export async function getTableSchema(tableId: string): Promise<ServiceResult<TableSchema>> {
  try {
    const table = await db.dataTable.findUnique({
      where: { id: tableId },
      include: {
        fields: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!table) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "数据表不存在" },
      };
    }

    return {
      success: true,
      data: {
        id: table.id,
        name: table.name,
        fields: table.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required,
          options: f.options as string[] | undefined,
        })),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取表结构失败";
    return { success: false, error: { code: "GET_FAILED", message } };
  }
}

// 搜索记录
export async function searchRecords(
  tableId: string,
  filters: FilterCondition[] = [],
  pagination?: { page: number; pageSize: number },
  sort?: SortConfig
): Promise<ServiceResult<SearchResult>> {
  try {
    // Verify table exists and get fields
    const table = await db.dataTable.findUnique({
      where: { id: tableId },
      include: {
        fields: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!table) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "数据表不存在" },
      };
    }

    const where: Record<string, unknown> = { tableId };

    // Build filter conditions
    if (filters.length > 0) {
      const filterConditions = buildFilterConditions(filters, table.fields.map((f) => ({
        key: f.key,
        type: f.type,
      })));
      if (filterConditions.length > 0) {
        where.AND = filterConditions;
      }
    }

    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    const [records, total] = await Promise.all([
      db.dataRecord.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: sort ? { [sort.field]: sort.direction } : { createdAt: "desc" },
      }),
      db.dataRecord.count({ where }),
    ]);

    return {
      success: true,
      data: {
        records: records.map((r) => r.data as Record<string, unknown>),
        total,
        page,
        pageSize,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "搜索记录失败";
    return { success: false, error: { code: "SEARCH_FAILED", message } };
  }
}

// 聚合统计
export async function aggregateRecords(
  tableId: string,
  field: string,
  operation: "count" | "sum" | "avg" | "min" | "max",
  filters?: FilterCondition[]
): Promise<ServiceResult<AggregateResult>> {
  try {
    // Verify table exists
    const table = await db.dataTable.findUnique({
      where: { id: tableId },
    });

    if (!table) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "数据表不存在" },
      };
    }

    const where: Record<string, unknown> = { tableId };

    // Build filter conditions
    if (filters && filters.length > 0) {
      // Get fields for building conditions (we need to know field types)
      const tableFields = await db.dataField.findMany({
        where: { tableId },
      });
      const filterConditions = buildFilterConditions(
        filters,
        tableFields.map((f) => ({ key: f.key, type: f.type }))
      );
      if (filterConditions.length > 0) {
        where.AND = filterConditions;
      }
    }

    // For count, use Prisma count
    if (operation === "count") {
      const count = await db.dataRecord.count({ where });
      return {
        success: true,
        data: {
          value: count,
          field,
          operation: "count",
        },
      };
    }

    // For sum/avg/min/max, we need to fetch records and compute in JavaScript
    // (Prisma JSONB doesn't support aggregation natively)
    const records = await db.dataRecord.findMany({
      where,
      select: { data: true },
    });

    const values: number[] = [];
    for (const record of records) {
      const data = record.data as Record<string, unknown>;
      const value = data[field];
      if (typeof value === "number" && !isNaN(value)) {
        values.push(value);
      } else if (typeof value === "string") {
        const num = Number(value);
        if (!isNaN(num)) {
          values.push(num);
        }
      }
    }

    let result: number;
    if (values.length === 0) {
      result = 0;
    } else {
      switch (operation) {
        case "sum":
          result = values.reduce((a, b) => a + b, 0);
          break;
        case "avg":
          result = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case "min":
          result = Math.min(...values);
          break;
        case "max":
          result = Math.max(...values);
          break;
        default:
          result = 0;
      }
    }

    return {
      success: true,
      data: {
        value: result,
        field,
        operation,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "聚合统计失败";
    return { success: false, error: { code: "AGGREGATE_FAILED", message } };
  }
}

// Helper: Build Prisma filter conditions from FilterCondition[]
function buildFilterConditions(
  filters: FilterCondition[],
  fields: Array<{ key: string; type: string }>
): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = [];

  for (const filter of filters) {
    const field = fields.find((f) => f.key === filter.field);
    if (!field) continue;

    switch (filter.operator) {
      case "eq":
        conditions.push({ data: { path: [filter.field], equals: filter.value } });
        break;
      case "ne":
        conditions.push({ NOT: { data: { path: [filter.field], equals: filter.value } } });
        break;
      case "contains":
        conditions.push({ data: { path: [filter.field], string_contains: String(filter.value) } });
        break;
      case "gt":
      case "gte":
      case "lt":
      case "lte":
        // For numeric comparisons, convert to string comparison
        conditions.push({ data: { path: [filter.field], string_contains: String(filter.value) } });
        break;
      case "in":
        if (Array.isArray(filter.value)) {
          conditions.push({ data: { path: [filter.field], equals: filter.value } });
        }
        break;
    }
  }

  return conditions;
}