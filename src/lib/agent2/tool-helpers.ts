// src/lib/agent2/tool-helpers.ts
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ServiceResult } from "@/types/data-table";

// ── SQL helpers ──

// 字段名白名单校验：防止 SQL 注入
function isSafeIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

// 将 FilterCondition[] 转换为原生 SQL WHERE 子句
function buildSqlWhereClause(
  tableId: string,
  filters: Array<{ field: string; operator: string; value: unknown }>,
  fields: Array<{ key: string; type: string }>
): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const conditions: string[] = [`"tableId" = $${params.push(tableId)}`];

  for (const filter of filters) {
    const field = fields.find(f => f.key === filter.field);
    if (!field || !isSafeIdentifier(filter.field)) continue;

    const paramIdx = params.push(filter.value);
    const jsonPath = `data->>'${filter.field}'`;

    switch (filter.operator) {
      case "eq":
        conditions.push(`${jsonPath} = $${paramIdx}`);
        break;
      case "ne":
        conditions.push(`${jsonPath} != $${paramIdx}`);
        break;
      case "contains":
        conditions.push(`${jsonPath} LIKE '%' || $${paramIdx} || '%'`);
        break;
      case "gt":
      case "gte":
      case "lt":
      case "lte": {
        if (field.type === "NUMBER") {
          const op = { gt: ">", gte: ">=", lt: "<", lte: "<=" }[filter.operator];
          conditions.push(`CAST(${jsonPath} AS NUMERIC) ${op} $${paramIdx}`);
        } else if (field.type === "DATE") {
          const op = { gt: ">", gte: ">=", lt: "<", lte: "<=" }[filter.operator];
          conditions.push(`CAST(${jsonPath} AS DATE) ${op} CAST($${paramIdx} AS DATE)`);
        }
        break;
      }
      case "in":
        if (Array.isArray(filter.value)) {
          const placeholders: string[] = [];
          for (const v of filter.value) {
            placeholders.push(`$${params.push(v)}`);
          }
          conditions.push(`${jsonPath} IN (${placeholders.join(", ")})`);
        }
        break;
    }
  }

  return { sql: conditions.join(" AND "), params };
}

// ── List all data tables ──

export async function listTables(): Promise<
  ServiceResult<
    Array<{
      id: string;
      name: string;
      description: string | null;
      icon: string | null;
      fieldCount: number;
      recordCount: number;
    }>
  >
> {
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
      })),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "获取数据表列表失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

// ── Get table schema with fields ──

export async function getTableSchema(tableId: string): Promise<
  ServiceResult<{
    id: string;
    name: string;
    description: string | null;
    fields: Array<{
      key: string;
      label: string;
      type: string;
      required: boolean;
      options?: string[];
    }>;
  }>
> {
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
        description: table.description,
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
    const message =
      error instanceof Error ? error.message : "获取表结构失败";
    return { success: false, error: { code: "GET_SCHEMA_FAILED", message } };
  }
}

// ── Search records with filtering, pagination, sorting ──

interface FilterCondition {
  field: string;
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "in";
  value: unknown;
}

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
        conditions.push({
          data: { path: [filter.field], equals: filter.value },
        });
        break;
      case "ne":
        conditions.push({
          NOT: { data: { path: [filter.field], equals: filter.value } },
        });
        break;
      case "contains":
        conditions.push({
          data: {
            path: [filter.field],
            string_contains: String(filter.value),
          },
        });
        break;
      case "gt":
      case "gte":
      case "lt":
      case "lte":
        // JSON field numeric comparison requires application-level filtering.
        // We do not push a Prisma condition here; filtering happens post-query.
        break;
      case "in":
        if (Array.isArray(filter.value)) {
          conditions.push({
            data: { path: [filter.field], equals: filter.value },
          });
        }
        break;
    }
  }

  return conditions;
}

function extractNumericComparisons(
  filters: FilterCondition[]
): FilterCondition[] {
  return filters.filter((f) =>
    ["gt", "gte", "lt", "lte"].includes(f.operator)
  );
}

function applyNumericFilters(
  records: Array<Record<string, unknown>>,
  numericFilters: FilterCondition[]
): Array<Record<string, unknown>> {
  if (numericFilters.length === 0) return records;

  return records.filter((record) => {
    return numericFilters.every((filter) => {
      const rawValue = record[filter.field];
      const numValue = typeof rawValue === "number" ? rawValue : Number(rawValue);
      const filterNum = typeof filter.value === "number" ? filter.value : Number(filter.value);
      if (isNaN(numValue) || isNaN(filterNum)) return true; // skip non-numeric

      switch (filter.operator) {
        case "gt": return numValue > filterNum;
        case "gte": return numValue >= filterNum;
        case "lt": return numValue < filterNum;
        case "lte": return numValue <= filterNum;
        default: return true;
      }
    });
  });
}

export async function searchRecords(params: {
  tableId: string;
  filters?: Array<{
    field: string;
    operator: string;
    value: unknown;
  }>;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}): Promise<
  ServiceResult<{
    records: Array<{ id: string; [key: string]: unknown }>;
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  try {
    const { tableId, filters = [], page = 1, pageSize = 10, sortBy, sortOrder = "desc" } = params;

    const table = await db.dataTable.findUnique({
      where: { id: tableId },
      include: { fields: { orderBy: { sortOrder: "asc" } } },
    });

    if (!table) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "数据表不存在" },
      };
    }

    const where: Record<string, unknown> = { tableId };

    const typedFilters: FilterCondition[] = filters.map((f) => ({
      field: f.field,
      operator: f.operator as FilterCondition["operator"],
      value: f.value,
    }));

    const numericFilters = extractNumericComparisons(typedFilters);
    const hasNumericFilters = numericFilters.length > 0;

    if (filters.length > 0) {
      const filterConditions = buildFilterConditions(
        typedFilters,
        table.fields.map((f) => ({ key: f.key, type: f.type }))
      );
      if (filterConditions.length > 0) {
        where.AND = filterConditions;
      }
    }

    if (hasNumericFilters) {
      // Fetch all matching records, apply numeric filters in JS, then paginate
      const allRecords = await db.dataRecord.findMany({
        where,
        orderBy: sortBy
          ? { [sortBy]: sortOrder }
          : { createdAt: "desc" },
      });

      const expanded = allRecords.map((r) => ({
        id: r.id,
        ...(r.data as Record<string, unknown>),
      }));

      const filtered = applyNumericFilters(expanded, numericFilters);
      const total = filtered.length;
      const skip = (page - 1) * pageSize;
      const paged = filtered.slice(skip, skip + pageSize);

      return {
        success: true,
        data: {
          records: paged as Array<{ id: string; [key: string]: unknown }>,
          total,
          page,
          pageSize,
        },
      };
    }

    const skip = (page - 1) * pageSize;

    const [records, total] = await Promise.all([
      db.dataRecord.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: sortBy
          ? { [sortBy]: sortOrder }
          : { createdAt: "desc" },
      }),
      db.dataRecord.count({ where }),
    ]);

    return {
      success: true,
      data: {
        records: records.map((r) => ({
          id: r.id,
          ...(r.data as Record<string, unknown>),
        })),
        total,
        page,
        pageSize,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "搜索记录失败";
    return { success: false, error: { code: "SEARCH_FAILED", message } };
  }
}

// ── Aggregate records ──

export async function aggregateRecords(params: {
  tableId: string;
  field: string;
  operation: "count" | "sum" | "avg" | "min" | "max";
  filters?: Array<{
    field: string;
    operator: string;
    value: unknown;
  }>;
}): Promise<
  ServiceResult<{
    value: number;
    field: string;
    operation: string;
  }>
> {
  try {
    const { tableId, field, operation, filters = [] } = params;

    const table = await db.dataTable.findUnique({
      where: { id: tableId },
    });

    if (!table) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "数据表不存在" },
      };
    }

    // count 仍用 Prisma（已足够高效）
    if (operation === "count") {
      const where: Record<string, unknown> = { tableId };

      if (filters.length > 0) {
        const tableFields = await db.dataField.findMany({
          where: { tableId },
        });
        const typedFilters = filters.map((f) => ({
          field: f.field,
          operator: f.operator as "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "in",
          value: f.value,
        }));
        const filterConditions = buildFilterConditions(
          typedFilters,
          tableFields.map((f) => ({ key: f.key, type: f.type }))
        );
        if (filterConditions.length > 0) {
          where.AND = filterConditions;
        }
      }

      const count = await db.dataRecord.count({ where });
      return { success: true, data: { value: count, field, operation } };
    }

    // sum/avg/min/max: 原生 SQL
    if (!isSafeIdentifier(field)) {
      return {
        success: false,
        error: { code: "INVALID_FIELD", message: "无效字段名" },
      };
    }

    const tableFields = await db.dataField.findMany({
      where: { tableId },
    });
    const targetField = tableFields.find((f) => f.key === field);

    if (!targetField) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "聚合字段不存在" },
      };
    }

    const castType = targetField.type === "DATE" ? "DATE" : "NUMERIC";
    const sqlOperation = {
      sum: "SUM",
      avg: "AVG",
      min: "MIN",
      max: "MAX",
    }[operation];

    if (!sqlOperation) {
      return {
        success: false,
        error: { code: "INVALID_OPERATION", message: "无效聚合操作" },
      };
    }

    const { sql: whereSql, params: whereParams } = buildSqlWhereClause(
      tableId, filters, tableFields
    );

    const result = await db.$queryRawUnsafe<Array<{ value: number }>>(
      `SELECT COALESCE(${sqlOperation}(CAST(data->>'${field}' AS ${castType})), 0) as value
       FROM "DataRecord"
       WHERE ${whereSql}`,
      ...whereParams
    );

    return { success: true, data: { value: Number(result[0].value), field, operation } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "聚合统计失败";
    return { success: false, error: { code: "AGGREGATE_FAILED", message } };
  }
}

// ── List templates ──

export async function listTemplates(): Promise<
  ServiceResult<
    Array<{
      id: string;
      name: string;
      description: string | null;
      status: string;
      createdAt: Date;
    }>
  >
> {
  try {
    const templates = await db.template.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      data: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        status: t.status,
        createdAt: t.createdAt,
      })),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "获取模板列表失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

// ── Get template detail with placeholders ──

export async function getTemplateDetail(templateId: string): Promise<
  ServiceResult<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    placeholders: Array<{
      id: string;
      key: string;
      label: string;
      inputType: string;
      required: boolean;
      defaultValue: string | null;
    }>;
  }>
> {
  try {
    const template = await db.template.findUnique({
      where: { id: templateId },
      include: {
        placeholders: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!template) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "模板不存在" },
      };
    }

    return {
      success: true,
      data: {
        id: template.id,
        name: template.name,
        description: template.description,
        status: template.status,
        placeholders: template.placeholders.map((p) => ({
          id: p.id,
          key: p.key,
          label: p.label,
          inputType: p.inputType,
          required: p.required,
          defaultValue: p.defaultValue,
        })),
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "获取模板详情失败";
    return { success: false, error: { code: "GET_FAILED", message } };
  }
}

// ── Get single record ──

export async function getRecord(
  recordId: string
): Promise<
  ServiceResult<{ id: string; tableId: string; [key: string]: unknown }>
> {
  try {
    const record = await db.dataRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "记录不存在" },
      };
    }

    return {
      success: true,
      data: {
        id: record.id,
        tableId: record.tableId,
        ...(record.data as Record<string, unknown>),
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "获取记录失败";
    return { success: false, error: { code: "GET_FAILED", message } };
  }
}

// ── Create record ──

/** @deprecated 使用 data-record.service.createRecord 替代 */
export async function createRecord(
  userId: string,
  tableId: string,
  data: Record<string, unknown>
): Promise<ServiceResult<{ id: string }>> {
  try {
    const table = await db.dataTable.findUnique({
      where: { id: tableId },
    });

    if (!table) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "数据表不存在" },
      };
    }

    const record = await db.dataRecord.create({
      data: {
        tableId,
        data: data as Prisma.InputJsonValue,
        createdById: userId,
      },
    });

    return { success: true, data: { id: record.id } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "创建记录失败";
    return { success: false, error: { code: "CREATE_FAILED", message } };
  }
}

// ── Update record ──

/** @deprecated 使用 data-record.service.updateRecord 替代 */
export async function updateRecord(
  recordId: string,
  data: Record<string, unknown>
): Promise<ServiceResult<{ id: string }>> {
  try {
    const existing = await db.dataRecord.findUnique({
      where: { id: recordId },
    });

    if (!existing) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "记录不存在" },
      };
    }

    const merged = {
      ...((existing.data as Record<string, unknown>) ?? {}),
      ...data,
    } as Prisma.InputJsonValue;

    const record = await db.dataRecord.update({
      where: { id: recordId },
      data: { data: merged },
    });

    return { success: true, data: { id: record.id } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "更新记录失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}

// ── Delete record ──

/** @deprecated 使用 data-record.service.deleteRecord 替代 */
export async function deleteRecord(
  recordId: string
): Promise<ServiceResult<{ id: string }>> {
  try {
    const existing = await db.dataRecord.findUnique({
      where: { id: recordId },
    });

    if (!existing) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "记录不存在" },
      };
    }

    await db.dataRecord.delete({
      where: { id: recordId },
    });

    return { success: true, data: { id: recordId } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "删除记录失败";
    return { success: false, error: { code: "DELETE_FAILED", message } };
  }
}
