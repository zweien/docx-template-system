// src/lib/agent2/tool-helpers.ts
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

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
        conditions.push({
          data: {
            path: [filter.field],
            string_contains: String(filter.value),
          },
        });
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

    if (filters.length > 0) {
      const typedFilters: FilterCondition[] = filters.map((f) => ({
        field: f.field,
        operator: f.operator as FilterCondition["operator"],
        value: f.value,
      }));
      const filterConditions = buildFilterConditions(
        typedFilters,
        table.fields.map((f) => ({ key: f.key, type: f.type }))
      );
      if (filterConditions.length > 0) {
        where.AND = filterConditions;
      }
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

    const where: Record<string, unknown> = { tableId };

    if (filters.length > 0) {
      const tableFields = await db.dataField.findMany({
        where: { tableId },
      });
      const typedFilters: FilterCondition[] = filters.map((f) => ({
        field: f.field,
        operator: f.operator as FilterCondition["operator"],
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

    if (operation === "count") {
      const count = await db.dataRecord.count({ where });
      return { success: true, data: { value: count, field, operation } };
    }

    // sum/avg/min/max: fetch records and compute in JS
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
        if (!isNaN(num)) values.push(num);
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

    return { success: true, data: { value: result, field, operation } };
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
