// src/lib/agent2/tool-helpers.ts
import { db } from "@/lib/db";
import * as nocodb from "@/lib/nocodb";
import { mapColumns } from "@/lib/nocodb/field-mapper";
import * as nocodbClient from "@/lib/nocodb/client";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

// ── TTL 缓存（进程内、单实例、best-effort）──
const TTL_MS = 30_000;
const cacheMap = new Map<string, { data: unknown; expiresAt: number }>();

function cacheGet<T>(key: string): T | null {
  const entry = cacheMap.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheMap.delete(key);
    return null;
  }
  return entry.data as T;
}

function cacheSet(key: string, data: unknown): void {
  cacheMap.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

export function invalidateSchemaCache(tableId: string): void {
  cacheMap.delete(`schema:${tableId}`);
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
    const tables = await nocodb.listTables();

    return {
      success: true,
      data: tables.map((t) => ({
        id: t.id,
        name: t.name,
        description: null,
        icon: null,
        fieldCount: t.fieldCount,
        recordCount: t.recordCount,
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
      relationTo?: string | null;
      displayField?: string | null;
      cardinality?: string | null;
    }>;
  }>
> {
  const cacheKey = `schema:${tableId}`;
  const cached = cacheGet<Awaited<ReturnType<typeof getTableSchema>>>(cacheKey);
  if (cached) return cached;

  try {
    const detail = await nocodb.getTableDetail(tableId);

    const result = {
      success: true as const,
      data: {
        id: detail.id,
        name: detail.name,
        description: null,
        fields: detail.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required,
          options: f.options as string[] | undefined,
          relationTo: f.relationTargetTableId ?? undefined,
          displayField: undefined,
          cardinality: f.relationType ?? undefined,
        })),
      },
    };

    cacheSet(cacheKey, result);
    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "获取表结构失败";
    return { success: false, error: { code: "GET_SCHEMA_FAILED", message } };
  }
}

// ── Search records with filtering, pagination, sorting ──

interface FilterCondition {
  field: string;
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "in" | "isempty" | "isnotempty";
  value: unknown;
}

function buildNocoDBWhere(
  filters: FilterCondition[],
  fields: Array<{ key: string; type: string; label?: string }>
): { where: string; warnings: string[] } {
  const warnings: string[] = [];
  const conditions: string[] = [];

  for (const filter of filters) {
    const resolvedKey = resolveFieldKey(filter.field, fields);
    if (!resolvedKey) {
      warnings.push(`过滤字段 '${filter.field}' 在表中不存在，已跳过`);
      continue;
    }

    switch (filter.operator) {
      case "eq":
        conditions.push(`(${resolvedKey},eq,${filter.value})`);
        break;
      case "ne":
        conditions.push(`(${resolvedKey},neq,${filter.value})`);
        break;
      case "contains":
        conditions.push(`(${resolvedKey},like,%${filter.value}%)`);
        break;
      case "gt":
        conditions.push(`(${resolvedKey},gt,${filter.value})`);
        break;
      case "gte":
        conditions.push(`(${resolvedKey},ge,${filter.value})`);
        break;
      case "lt":
        conditions.push(`(${resolvedKey},lt,${filter.value})`);
        break;
      case "lte":
        conditions.push(`(${resolvedKey},le,${filter.value})`);
        break;
      case "isempty":
        conditions.push(`(${resolvedKey},eq,)`);
        break;
      case "isnotempty":
        conditions.push(`(${resolvedKey},neq,)`);
        break;
      case "in":
        if (Array.isArray(filter.value)) {
          // NocoDB doesn't have a native IN operator, use multiple OR conditions
          const inConditions = filter.value.map((v) => `(${resolvedKey},eq,${v})`);
          conditions.push(`(${inConditions.join("~or")})`);
        }
        break;
    }
  }

  return { where: conditions.join("~and"), warnings };
}

function resolveFieldKey(
  filterField: string,
  fields: Array<{ key: string; label?: string }>
): string | null {
  if (fields.some(f => f.key === filterField)) return filterField;
  const byLabel = fields.find(f => f.label === filterField);
  return byLabel ? byLabel.key : null;
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
  search?: string;
}): Promise<
  ServiceResult<{
    records: Array<{ id: string; tableId?: string; [key: string]: unknown }>;
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  try {
    const { tableId, filters = [], page = 1, pageSize = 10, sortBy, sortOrder = "desc" } = params;

    const schema = await getTableSchema(tableId);
    if (!schema.success) return schema as ServiceResult<never>;

    const typedFilters: FilterCondition[] = filters.map((f) => ({
      field: f.field,
      operator: f.operator as FilterCondition["operator"],
      value: f.value,
    }));

    const options: Parameters<typeof nocodb.listRecords>[1] = {
      page,
      pageSize,
    };

    if (typedFilters.length > 0) {
      const { where, warnings } = buildNocoDBWhere(
        typedFilters,
        schema.data.fields
      );
      if (where) {
        options.where = where;
      }
      if (warnings.length > 0) {
        console.warn("Filter warnings:", warnings);
      }
    }

    if (sortBy) {
      const resolvedKey = resolveFieldKey(sortBy, schema.data.fields);
      if (resolvedKey) {
        options.sort = sortOrder === "desc" ? `-${resolvedKey}` : resolvedKey;
      }
    }

    if (params.search) {
      options.search = params.search;
    }

    const result = await nocodb.listRecords(tableId, options);

    return {
      success: true,
      data: {
        records: result.records.map((r) => ({
          id: String(r.id),
          tableId,
          ...r.data,
        })),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
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

    // For NocoDB, we do client-side aggregation for now
    // Fetch all matching records and compute the aggregate
    const schema = await getTableSchema(tableId);
    if (!schema.success) return schema as ServiceResult<never>;

    const options: Parameters<typeof nocodb.listRecords>[1] = {
      page: 1,
      pageSize: 1000, // Fetch enough for aggregation
    };

    if (filters.length > 0) {
      const typedFilters: FilterCondition[] = filters.map((f) => ({
        field: f.field,
        operator: f.operator as FilterCondition["operator"],
        value: f.value,
      }));
      const { where } = buildNocoDBWhere(typedFilters, schema.data.fields);
      if (where) options.where = where;
    }

    const result = await nocodb.listRecords(tableId, options);
    const records = result.records;

    let value = 0;
    switch (operation) {
      case "count":
        value = result.total;
        break;
      case "sum": {
        value = records.reduce((sum, r) => {
          const v = Number(r.data[field]);
          return sum + (isNaN(v) ? 0 : v);
        }, 0);
        break;
      }
      case "avg": {
        const nums = records.map((r) => Number(r.data[field])).filter((n) => !isNaN(n));
        value = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        break;
      }
      case "min": {
        const nums = records.map((r) => Number(r.data[field])).filter((n) => !isNaN(n));
        value = nums.length > 0 ? Math.min(...nums) : 0;
        break;
      }
      case "max": {
        const nums = records.map((r) => Number(r.data[field])).filter((n) => !isNaN(n));
        value = nums.length > 0 ? Math.max(...nums) : 0;
        break;
      }
    }

    return {
      success: true,
      data: {
        value,
        field,
        operation,
      },
    };
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
  tableId: string,
  recordId: string
): Promise<
  ServiceResult<{ id: string; tableId: string; [key: string]: unknown }>
> {
  try {
    const record = await nocodb.getRecord(tableId, recordId);

    return {
      success: true,
      data: {
        id: String(record.id),
        tableId,
        ...record.data,
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
): Promise<ServiceResult<{ id: string; tableId: string }>> {
  try {
    const record = await nocodb.createRecord(tableId, data);
    return { success: true, data: { id: String(record.id), tableId } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "创建记录失败";
    return { success: false, error: { code: "CREATE_FAILED", message } };
  }
}

// ── Update record ──

export async function updateRecord(
  tableId: string,
  recordId: string,
  data: Record<string, unknown>
): Promise<ServiceResult<{ id: string; tableId: string }>> {
  try {
    const record = await nocodb.updateRecord(tableId, recordId, data);
    return { success: true, data: { id: String(record.id), tableId } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "更新记录失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}

// ── Delete record ──

export async function deleteRecord(
  tableId: string,
  recordId: string
): Promise<ServiceResult<{ id: string }>> {
  try {
    await nocodb.deleteRecord(tableId, recordId);
    return { success: true, data: { id: recordId } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "删除记录失败";
    return { success: false, error: { code: "DELETE_FAILED", message } };
  }
}
