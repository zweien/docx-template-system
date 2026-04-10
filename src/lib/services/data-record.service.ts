import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type {
  DataRecordItem,
  PaginatedRecords,
  RelationSubtableValueItem,
  ServiceResult,
  DataFieldItem,
  SortConfig,
  FilterCondition,
  FilterGroup,
  AggregateType,
} from "@/types/data-table";
import { normalizeFilters, parseFieldOptions } from "@/types/data-table";
import { evaluateFormula } from "@/lib/formula";
import { getTable } from "./data-table.service";
import {
  removeAllRelationsForRecord,
  refreshSnapshotsForTargetRecord,
  syncRelationSubtableValues,
} from "./data-relation.service";

// Helper to convert Record<string, unknown> to Prisma JSON input
export function toJsonInput(data: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(data));
}

// P2: 筛选条件类型
export interface RecordFieldFilter {
  op?: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
  value: string | number;
}

export interface FieldFilters {
  [fieldKey: string]: RecordFieldFilter;
}

// P2: 构建 Prisma JSONB 筛选条件
function buildFieldFilterConditions(
  fieldFilters: FieldFilters,
  fields: DataFieldItem[]
): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = [];

  for (const [fieldKey, filter] of Object.entries(fieldFilters)) {
    const field = fields.find(f => f.key === fieldKey);
    if (!field) continue;

    const op = filter.op || 'eq';
    const value = filter.value;

    // 根据操作符构建 Prisma JSONB 查询
    switch (op) {
      case 'eq':
        conditions.push({
          data: { path: [fieldKey], equals: value }
        });
        break;
      case 'ne':
        conditions.push({
          NOT: { data: { path: [fieldKey], equals: value } }
        });
        break;
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
        // 数字和日期比较
        conditions.push({
          data: { path: [fieldKey], string_contains: String(value) }
        });
        break;
      case 'contains':
        conditions.push({
          data: { path: [fieldKey], string_contains: String(value) }
        });
        break;
    }
  }

  return conditions;
}

// ── Helpers ──

function mapRecordToItem(row: {
  id: string;
  tableId: string;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { name: string };
  updatedBy?: { name: string } | null;
}): DataRecordItem {
  return {
    id: row.id,
    tableId: row.tableId,
    data: row.data as Record<string, unknown>,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByName: row.createdBy.name,
    updatedByName: row.updatedBy?.name ?? null,
  };
}

/**
 * Inject SYSTEM_TIMESTAMP and SYSTEM_USER field values from record metadata.
 * These fields read from createdAt/updatedAt/createdBy rather than from the JSONB data.
 */
function injectSystemFieldValues(
  records: DataRecordItem[],
  fields: DataFieldItem[]
): void {
  const systemFields = fields.filter(
    (f) => f.type === "SYSTEM_TIMESTAMP" || f.type === "SYSTEM_USER"
  );
  if (systemFields.length === 0) return;

  for (const record of records) {
    for (const field of systemFields) {
      const opts = parseFieldOptions(field.options);
      const kind = opts.kind ?? "created";

      if (field.type === "SYSTEM_TIMESTAMP") {
        record.data[field.key] = kind === "updated"
          ? record.updatedAt.toISOString()
          : record.createdAt.toISOString();
      } else if (field.type === "SYSTEM_USER") {
        record.data[field.key] = kind === "updated"
          ? (record.updatedByName ?? "")
          : record.createdByName;
      }
    }
  }
}

/** Normalize BOOLEAN field values from strings to actual booleans */
function normalizeBooleanFields(
  data: Record<string, unknown>,
  fields: DataFieldItem[]
): void {
  for (const field of fields) {
    if (field.type !== "BOOLEAN") continue;
    const value = data[field.key];
    if (value !== undefined && value !== null) {
      data[field.key] = value === true || value === "true" || value === 1;
    }
  }
}

function splitRecordDataByFieldType(
  data: Record<string, unknown>,
  fields: DataFieldItem[]
): {
  scalarData: Record<string, unknown>;
  relationData: Record<
    string,
    RelationSubtableValueItem[] | RelationSubtableValueItem | null
  >;
} {
  const fieldTypeByKey = new Map(fields.map((field) => [field.key, field.type]));
  const scalarData: Record<string, unknown> = {};
  const relationData: Record<
    string,
    RelationSubtableValueItem[] | RelationSubtableValueItem | null
  > = {};

  for (const [fieldKey, value] of Object.entries(data)) {
    if (fieldTypeByKey.get(fieldKey) === "RELATION_SUBTABLE") {
      relationData[fieldKey] = value as
        | RelationSubtableValueItem[]
        | RelationSubtableValueItem
        | null;
      continue;
    }

    scalarData[fieldKey] = value;
  }

  return { scalarData, relationData };
}

function computeFormulaValues(
  recordData: Record<string, unknown>,
  fields: DataFieldItem[]
): Record<string, unknown> {
  const formulaFields = fields.filter((f) => f.type === "FORMULA");
  if (formulaFields.length === 0) return recordData;
  const enriched = { ...recordData };
  for (const field of formulaFields) {
    const opts = parseFieldOptions(field.options);
    if (!opts.formula) continue;
    enriched[field.key] = evaluateFormula(opts.formula, enriched);
  }
  return enriched;
}

function getComparableValue(value: unknown): unknown {
  if (typeof value === "object" && value !== null && "display" in value) {
    return (value as { display: unknown }).display;
  }

  return value;
}

function compareRecordValues(aValue: unknown, bValue: unknown, order: SortConfig["order"]): number {
  const aDisplay = getComparableValue(aValue);
  const bDisplay = getComparableValue(bValue);
  const aNum = Number(aDisplay);
  const bNum = Number(bDisplay);

  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
    return order === "asc" ? aNum - bNum : bNum - aNum;
  }

  const aStr = String(aDisplay ?? "");
  const bStr = String(bDisplay ?? "");
  return order === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
}

// ── Record Management ──

export async function listRecords(
  tableId: string,
  filters: {
    page: number;
    pageSize: number;
    search?: string;
    // P2: 新增字段筛选
    fieldFilters?: FieldFilters;
    sortBy?: SortConfig[] | null;
    filterConditions?: FilterGroup[] | FilterCondition[];
  }
): Promise<ServiceResult<PaginatedRecords>> {
  try {
    // Verify table exists and get fields
    const tableResult = await getTable(tableId);
    if (!tableResult.success) {
      return { success: false, error: tableResult.error };
    }

    const where: Record<string, unknown> = { tableId };

    // Build search conditions - search across all text fields in JSON
    if (filters.search) {
      const searchFields = tableResult.data.fields
        .filter(f => f.type === "TEXT" || f.type === "EMAIL" || f.type === "SELECT")
        .map(f => f.key);

      if (searchFields.length > 0) {
        // Build OR conditions for each searchable field
        where.OR = searchFields.map(fieldKey => ({
          data: { path: [fieldKey], string_contains: filters.search }
        }));
      }
    }

    // P2: Build field filter conditions
    const fieldFilterConditions = filters.fieldFilters
      ? buildFieldFilterConditions(filters.fieldFilters, tableResult.data.fields)
      : [];

    // Combine field filter conditions (not search - that's handled by OR above)
    if (fieldFilterConditions.length > 0) {
      where.AND = fieldFilterConditions;
    }

    // Build view-level filter conditions from FilterCondition[]
    if (filters.filterConditions && filters.filterConditions.length > 0) {
      const viewFilterConditions = buildFilterConditionsFromSpec(
        filters.filterConditions,
        tableResult.data.fields
      );
      if (viewFilterConditions.length > 0) {
        const existingAnd = Array.isArray(where.AND) ? [...where.AND] : [];
        where.AND = [...existingAnd, ...viewFilterConditions];
      }
    }

    // 当有 sortBy 时，需要先取全部数据排序再分页，否则排序只在当前页内生效
    const hasSort = filters.sortBy && filters.sortBy.length > 0;
    const sortableFields = hasSort
      ? filters.sortBy!.filter((sortConfig) =>
          tableResult.data.fields.some((field) => field.key === sortConfig.fieldKey)
        )
      : [];

    let processedRecords: DataRecordItem[];
    let total: number;

    if (sortableFields.length > 0) {
      // 有排序：取全部匹配记录 → 内存排序 → 手动分页
      const [allRecords, totalCount] = await Promise.all([
        db.dataRecord.findMany({
          where,
          include: {
            createdBy: { select: { name: true } },
            updatedBy: { select: { name: true } },
          },
        }),
        db.dataRecord.count({ where }),
      ]);
      total = totalCount;
      processedRecords = allRecords.map(mapRecordToItem).sort((a, b) => {
        for (const { fieldKey, order } of sortableFields) {
          const result = compareRecordValues(a.data[fieldKey], b.data[fieldKey], order);
          if (result !== 0) return result;
        }
        return 0;
      });
      const start = (filters.page - 1) * filters.pageSize;
      processedRecords = processedRecords.slice(start, start + filters.pageSize);
    } else {
      // 无排序：直接 DB 分页（默认按创建时间倒序）
      const [records, totalCount] = await Promise.all([
        db.dataRecord.findMany({
          where,
          skip: (filters.page - 1) * filters.pageSize,
          take: filters.pageSize,
          orderBy: { createdAt: "desc" },
          include: {
            createdBy: { select: { name: true } },
            updatedBy: { select: { name: true } },
          },
        }),
        db.dataRecord.count({ where }),
      ]);
      total = totalCount;
      processedRecords = records.map(mapRecordToItem);
    }

    // Resolve RELATION fields - batch fetch related records
    const relationFields = tableResult.data.fields.filter(
      f => f.type === "RELATION" && f.relationTo && f.displayField
    );

    if (relationFields.length > 0) {
      // Collect all relation IDs for each relation table
      const relationIdsByTable: Map<string, Set<string>> = new Map();
      for (const field of relationFields) {
        const relTableId = field.relationTo!;
        if (!relationIdsByTable.has(relTableId)) {
          relationIdsByTable.set(relTableId, new Set());
        }
        const ids = relationIdsByTable.get(relTableId)!;
        for (const record of processedRecords) {
          const relId = record.data[field.key];
          if (typeof relId === "string" && relId) {
            ids.add(relId);
          }
        }
      }

      // Batch fetch related records for each table
      const relatedRecordsMap: Map<string, Record<string, unknown>> = new Map();
      for (const [, ids] of relationIdsByTable) {
        if (ids.size > 0) {
          const relatedRecords = await db.dataRecord.findMany({
            where: { id: { in: Array.from(ids) } },
          });
          for (const rel of relatedRecords) {
            relatedRecordsMap.set(rel.id, rel.data as Record<string, unknown>);
          }
        }
      }

      // Update records with display values
      for (const record of processedRecords) {
        for (const field of relationFields) {
          const relId = record.data[field.key];
          if (typeof relId === "string" && relId) {
            const relatedData = relatedRecordsMap.get(relId);
            if (relatedData && field.displayField) {
              record.data[field.key] = {
                id: relId,
                display: relatedData[field.displayField] ?? relId,
              };
            }
          }
        }
      }
    }

    // Resolve RELATION_SUBTABLE display values at read time
    // Snapshots may be stale or have incorrect displayValue (e.g. wrong displayField config)
    const subtableFields = tableResult.data.fields.filter(
      f => f.type === "RELATION_SUBTABLE" && f.relationTo && f.displayField
    );

    if (subtableFields.length > 0) {
      // Collect all targetRecordIds across all records for each subtable field
      const subtableTargetIds = new Set<string>();
      for (const field of subtableFields) {
        for (const record of processedRecords) {
          const snapshot = record.data[field.key];
          if (Array.isArray(snapshot)) {
            for (const item of snapshot as RelationSubtableValueItem[]) {
              if (item.targetRecordId) {
                subtableTargetIds.add(item.targetRecordId);
              }
            }
          }
        }
      }

      // Batch fetch target records
      let subtableRelatedMap: Map<string, Record<string, unknown>>;
      if (subtableTargetIds.size > 0) {
        const subtableRelatedRecords = await db.dataRecord.findMany({
          where: { id: { in: Array.from(subtableTargetIds) } },
        });
        subtableRelatedMap = new Map(
          subtableRelatedRecords.map((r) => [r.id, r.data as Record<string, unknown>])
        );
      } else {
        subtableRelatedMap = new Map();
      }

      // Fix displayValue for each snapshot item
      for (const record of processedRecords) {
        for (const field of subtableFields) {
          const snapshot = record.data[field.key];
          if (!Array.isArray(snapshot)) continue;

          let changed = false;
          const fixed = (snapshot as RelationSubtableValueItem[]).map((item) => {
            const targetData = subtableRelatedMap.get(item.targetRecordId);
            const correctDisplay = targetData && field.displayField
              ? String(targetData[field.displayField] ?? item.targetRecordId)
              : item.displayValue ?? item.targetRecordId;
            if (correctDisplay !== item.displayValue) {
              changed = true;
              return { ...item, displayValue: correctDisplay };
            }
            return item;
          });

          if (changed) {
            record.data[field.key] = fixed;
          }
        }
      }
    }

    // Resolve SYSTEM_TIMESTAMP and SYSTEM_USER fields from record metadata
    injectSystemFieldValues(processedRecords, tableResult.data.fields);

    return {
      success: true,
      data: {
        records: processedRecords,
        total,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.ceil(total / filters.pageSize),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取记录列表失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

export async function getRecord(id: string): Promise<ServiceResult<DataRecordItem>> {
  try {
    const record = await db.dataRecord.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true } },
      },
    });

    if (!record) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "记录不存在" },
      };
    }

    return { success: true, data: mapRecordToItem(record) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取记录详情失败";
    return { success: false, error: { code: "GET_FAILED", message } };
  }
}

export async function createRecord(
  userId: string,
  tableId: string,
  data: Record<string, unknown>
): Promise<ServiceResult<DataRecordItem>> {
  try {
    // Get table and validate data against fields
    const tableResult = await getTable(tableId);
    if (!tableResult.success) {
      return { success: false, error: tableResult.error };
    }

    const validation = validateRecordData(data, tableResult.data.fields);
    if (!validation.success) {
      return validation;
    }

    normalizeBooleanFields(data, tableResult.data.fields);

    const record = await db.$transaction(async (tx) => {
      // ── Auto-number injection (inside transaction for atomicity) ──
      const autoNumberFields = tableResult.data.fields.filter(
        (f) => f.type === "AUTO_NUMBER"
      );
      for (const field of autoNumberFields) {
        const lockedField = await tx.dataField.findUniqueOrThrow({
          where: { id: field.id },
        });
        const opts = parseFieldOptions(lockedField.options);
        const nextVal = (opts.nextValue ?? 0) + 1;
        data[field.key] = nextVal;
        await tx.dataField.update({
          where: { id: field.id },
          data: { options: toJsonInput({ ...opts, nextValue: nextVal }) },
        });
      }

      const { scalarData, relationData } = splitRecordDataByFieldType(
        data,
        tableResult.data.fields
      );

      const enrichedScalarData = computeFormulaValues(scalarData, tableResult.data.fields);

      const createdRecord = await tx.dataRecord.create({
        data: {
          tableId,
          data: toJsonInput(enrichedScalarData),
          createdById: userId,
        },
        include: {
          createdBy: { select: { name: true } },
        },
      });

      if (Object.keys(relationData).length > 0) {
        const relationResult = await syncRelationSubtableValues({
          tx,
          sourceRecordId: createdRecord.id,
          tableId,
          relationPayload: relationData,
        });
        if (!relationResult.success) {
          throw new Error(`${relationResult.error.code}:${relationResult.error.message}`);
        }
      }

      return tx.dataRecord.findUnique({
        where: { id: createdRecord.id },
        include: {
          createdBy: { select: { name: true } },
        },
      });
    });

    if (!record) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "记录不存在" },
      };
    }

    return { success: true, data: mapRecordToItem(record) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建记录失败";
    return { success: false, error: { code: "CREATE_FAILED", message } };
  }
}

// 内部函数：在事务中执行更新（供 updateRecord 和 batchUpdate 调用）
async function doUpdateRecord(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  id: string,
  data: Record<string, unknown>,
  existingRecord: { id: string; tableId: string; data: unknown },
  userId: string
): Promise<DataRecordItem> {
  const tableResult = await getTable(existingRecord.tableId);
  if (!tableResult.success) {
    throw new Error(`${tableResult.error.code}:${tableResult.error.message}`);
  }

  const validation = validateRecordData(data, tableResult.data.fields);
  if (!validation.success) {
    throw new Error(`${validation.error.code}:${validation.error.message}`);
  }

  normalizeBooleanFields(data, tableResult.data.fields);

  const { scalarData, relationData } = splitRecordDataByFieldType(
    data,
    tableResult.data.fields
  );

  await tx.dataRecord.update({
    where: { id },
    data: {
      data: toJsonInput({
        ...(existingRecord.data as Record<string, unknown>),
        ...scalarData,
      }),
      updatedById: userId,
    },
  });

  if (Object.keys(scalarData).length > 0) {
    const refreshResult = await refreshSnapshotsForTargetRecord({
      tx,
      recordId: id,
    });
    if (!refreshResult.success) {
      throw new Error(`${refreshResult.error.code}:${refreshResult.error.message}`);
    }
  }

  if (Object.keys(relationData).length > 0) {
    const relationResult = await syncRelationSubtableValues({
      tx,
      sourceRecordId: id,
      tableId: existingRecord.tableId,
      relationPayload: relationData,
    });
    if (!relationResult.success) {
      throw new Error(`${relationResult.error.code}:${relationResult.error.message}`);
    }
  }

  const record = await tx.dataRecord.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } } },
  });

  if (!record) throw new Error("NOT_FOUND:记录不存在");
  return mapRecordToItem(record);
}

export async function updateRecord(
  id: string,
  data: Record<string, unknown>,
  userId: string
): Promise<ServiceResult<DataRecordItem>> {
  try {
    const existingRecord = await db.dataRecord.findUnique({ where: { id } });
    if (!existingRecord) {
      return { success: false, error: { code: "NOT_FOUND", message: "记录不存在" } };
    }

    const result = await db.$transaction(tx =>
      doUpdateRecord(tx, id, data, existingRecord, userId)
    );
    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新记录失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}

/**
 * Patch a single field on a record (for inline editing).
 * Validates only the patched field, preserves all other fields.
 */
export async function patchField(
  recordId: string,
  fieldKey: string,
  value: unknown,
  userId: string
): Promise<ServiceResult<DataRecordItem>> {
  try {
    const existingRecord = await db.dataRecord.findUnique({ where: { id: recordId } });
    if (!existingRecord) {
      return { success: false, error: { code: "NOT_FOUND", message: "记录不存在" } };
    }

    const tableResult = await getTable(existingRecord.tableId);
    if (!tableResult.success) {
      return { success: false, error: tableResult.error };
    }

    const field = tableResult.data.fields.find((f) => f.key === fieldKey);
    if (!field) {
      return { success: false, error: { code: "VALIDATION_ERROR", message: `字段 "${fieldKey}" 不存在` } };
    }

    // Validate just this field
    if (field.required && (value === null || value === undefined || value === "")) {
      return {
        success: false,
        error: { code: "VALIDATION_ERROR", message: `字段 "${field.label}" 是必填项` },
      };
    }

    // Type-specific validation
    if (value !== null && value !== undefined && value !== "") {
      switch (field.type) {
        case "NUMBER":
          if (typeof value !== "number" && isNaN(Number(value))) {
            return {
              success: false,
              error: { code: "VALIDATION_ERROR", message: `字段 "${field.label}" 必须是数字` },
            };
          }
          break;
        case "EMAIL":
          if (typeof value === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return {
              success: false,
              error: { code: "VALIDATION_ERROR", message: `字段 "${field.label}" 必须是有效的邮箱地址` },
            };
          }
          break;
        case "SELECT":
          if (Array.isArray(field.options) && !field.options.includes(String(value))) {
            return {
              success: false,
              error: { code: "VALIDATION_ERROR", message: `字段 "${field.label}" 的值必须是选项之一` },
            };
          }
          break;
      }
    }

    // Normalize BOOLEAN values to actual booleans
    if (field.type === "BOOLEAN" && value !== null && value !== undefined) {
      value = value === true || value === "true" || value === 1;
    }

    // Update only the changed field
    const currentData = existingRecord.data as Record<string, unknown>;
    const updatedData = { ...currentData, [fieldKey]: value };

    const enrichedData = computeFormulaValues(updatedData, tableResult.data.fields);

    await db.dataRecord.update({
      where: { id: recordId },
      data: {
        data: toJsonInput(enrichedData),
        updatedById: userId,
      },
    });

    // Refresh snapshots only for relation fields
    if (field.type === "RELATION" || field.type === "RELATION_SUBTABLE") {
      try {
        await db.$transaction(async (tx) => {
          const refreshResult = await refreshSnapshotsForTargetRecord({ tx, recordId });
          if (!refreshResult.success) {
            throw new Error(`${refreshResult.error.code}:${refreshResult.error.message}`);
          }
        });
      } catch {
        // Snapshot refresh failure should not block the patch
      }
    }

    // Fetch updated record with relations
    const updatedRecord = await db.dataRecord.findUnique({
      where: { id: recordId },
      include: { createdBy: { select: { name: true } } },
    });

    if (!updatedRecord) {
      return { success: false, error: { code: "NOT_FOUND", message: "记录不存在" } };
    }

    return { success: true, data: mapRecordToItem(updatedRecord) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新字段失败";
    return { success: false, error: { code: "PATCH_FAILED", message } };
  }
}

// 内部函数：在事务中执行删除（供 deleteRecord 和 batchDelete 调用）
async function doDeleteRecord(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  id: string
): Promise<void> {
  const relationResult = await removeAllRelationsForRecord({
    tx,
    recordId: id,
  });
  if (!relationResult.success) {
    throw new Error(`${relationResult.error.code}:${relationResult.error.message}`);
  }

  await tx.dataRecord.delete({ where: { id } });
}

export async function deleteRecord(id: string): Promise<ServiceResult<null>> {
  try {
    const record = await db.dataRecord.findUnique({ where: { id } });
    if (!record) {
      return { success: false, error: { code: "NOT_FOUND", message: "记录不存在" } };
    }

    await db.$transaction(tx => doDeleteRecord(tx, id));
    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除记录失败";
    return { success: false, error: { code: "DELETE_FAILED", message } };
  }
}

// ── Batch Operations (for import) ──

export async function batchCreate(
  tableId: string,
  userId: string,
  records: Record<string, unknown>[]
): Promise<ServiceResult<{ created: number; errors: Array<{ row: number; message: string }> }>> {
  try {
    const tableResult = await getTable(tableId);
    if (!tableResult.success) {
      return { success: false, error: tableResult.error };
    }

    const errors: Array<{ row: number; message: string }> = [];
    const validRecords: Record<string, unknown>[] = [];

    records.forEach((record, index) => {
      const validation = validateRecordData(record, tableResult.data.fields);
      if (!validation.success) {
        errors.push({ row: index + 1, message: validation.error.message });
      } else {
        validRecords.push(record);
      }
    });

    if (validRecords.length > 0) {
      await db.dataRecord.createMany({
        data: validRecords.map((recordData) => ({
          tableId,
          data: toJsonInput(recordData),
          createdById: userId,
        })),
      });
    }

    return {
      success: true,
      data: {
        created: validRecords.length,
        errors,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "批量创建记录失败";
    return { success: false, error: { code: "BATCH_CREATE_FAILED", message } };
  }
}

export async function batchUpdate(
  tableId: string,
  updates: Array<{ id: string; data: Record<string, unknown> }>,
  userId: string
): Promise<ServiceResult<{ updated: number; errors: Array<{ recordId: string; message: string }> }>> {
  try {
    if (updates.length === 0) {
      return { success: true, data: { updated: 0, errors: [] } };
    }

    if (updates.length > 50) {
      return {
        success: false,
        error: { code: "TOO_MANY", message: "单次批量更新最多 50 条" },
      };
    }

    const errors: Array<{ recordId: string; message: string }> = [];
    let updated = 0;

    await db.$transaction(async (tx) => {
      for (const { id, data } of updates) {
        try {
          const existingRecord = await tx.dataRecord.findUnique({ where: { id } });
          if (!existingRecord) {
            errors.push({ recordId: id, message: "记录不存在" });
            throw new Error("SKIP");
          }
          if (existingRecord.tableId !== tableId) {
            errors.push({ recordId: id, message: "记录不属于目标表" });
            throw new Error("SKIP");
          }
          await doUpdateRecord(tx, id, data, existingRecord, userId);
          updated++;
        } catch (e) {
          if (e instanceof Error && e.message === "SKIP") continue;
          throw e; // Non-skip errors trigger transaction rollback
        }
      }
    });

    return { success: true, data: { updated, errors } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "批量更新失败";
    return { success: false, error: { code: "BATCH_UPDATE_FAILED", message } };
  }
}

export async function batchDelete(
  tableId: string,
  ids: string[]
): Promise<ServiceResult<{ deleted: number; errors: Array<{ recordId: string; message: string }> }>> {
  try {
    if (ids.length === 0) {
      return { success: true, data: { deleted: 0, errors: [] } };
    }

    if (ids.length > 50) {
      return {
        success: false,
        error: { code: "TOO_MANY", message: "单次批量删除最多 50 条" },
      };
    }

    const errors: Array<{ recordId: string; message: string }> = [];
    let deleted = 0;

    await db.$transaction(async (tx) => {
      for (const id of ids) {
        try {
          const record = await tx.dataRecord.findUnique({ where: { id } });
          if (!record) {
            errors.push({ recordId: id, message: "记录不存在" });
            throw new Error("SKIP");
          }
          if (record.tableId !== tableId) {
            errors.push({ recordId: id, message: "记录不属于目标表" });
            throw new Error("SKIP");
          }
          await doDeleteRecord(tx, id);
          deleted++;
        } catch (e) {
          if (e instanceof Error && e.message === "SKIP") continue;
          throw e;
        }
      }
    });

    return { success: true, data: { deleted, errors } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "批量删除失败";
    return { success: false, error: { code: "BATCH_DELETE_FAILED", message } };
  }
}

export async function findByUniqueField(
  tableId: string,
  fieldKey: string,
  value: unknown
): Promise<ServiceResult<DataRecordItem | null>> {
  try {
    // Query JSONB field for matching value
    const record = await db.dataRecord.findFirst({
      where: {
        tableId,
        data: {
          path: [fieldKey],
          equals: JSON.parse(JSON.stringify(value)),
        },
      },
      include: {
        createdBy: { select: { name: true } },
      },
    });

    if (!record) {
      return { success: true, data: null };
    }

    return { success: true, data: mapRecordToItem(record) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "查找记录失败";
    return { success: false, error: { code: "FIND_FAILED", message } };
  }
}

// ── View Filter Helpers ──

function buildConditionFromFilter(
  cond: FilterCondition,
  fields: DataFieldItem[]
): Record<string, unknown> | null {
  const field = fields.find((f) => f.key === cond.fieldKey)
  if (!field) return null

  switch (cond.op) {
    case "isempty":
      return { OR: [
        { data: { path: [cond.fieldKey], equals: null } },
        { data: { path: [cond.fieldKey], equals: "" } },
      ]}
    case "isnotempty":
      return { NOT: { OR: [
        { data: { path: [cond.fieldKey], equals: null } },
        { data: { path: [cond.fieldKey], equals: "" } },
      ]}}
    case "eq":
      return { data: { path: [cond.fieldKey], equals: cond.value } }
    case "ne":
      return { NOT: { data: { path: [cond.fieldKey], equals: cond.value } } }
    case "contains":
      return { data: { path: [cond.fieldKey], string_contains: String(cond.value) } }
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      // NOTE: string_contains is a known limitation for numeric comparison on JSONB
      return { data: { path: [cond.fieldKey], string_contains: String(cond.value) } }
    default:
      return null
  }
}

/** Build Prisma where conditions from FilterGroup[] (or legacy FilterCondition[]) */
function buildFilterConditionsFromSpec(
  filterInput: FilterGroup[] | FilterCondition[],
  fields: DataFieldItem[]
): Record<string, unknown>[] {
  const groups = normalizeFilters(filterInput)

  return groups
    .map((group) => {
      const built = group.conditions
        .map((c) => buildConditionFromFilter(c, fields))
        .filter(Boolean) as Record<string, unknown>[]

      if (built.length === 0) return null

      // If group operator is OR, wrap conditions in Prisma OR
      if (group.operator === "OR") {
        return { OR: built }
      }
      // AND: return each condition individually (they'll be AND-combined by caller)
      return built.length === 1 ? built[0] : { AND: built }
    })
    .filter(Boolean) as Record<string, unknown>[]
}

// ── Validation ──

export function validateRecordData(
  data: Record<string, unknown>,
  fields: DataFieldItem[]
): ServiceResult<boolean> {
  for (const field of fields) {
    const value = data[field.key];

    // Skip system-managed fields — not user-editable
    if (
      field.type === "AUTO_NUMBER" ||
      field.type === "SYSTEM_TIMESTAMP" ||
      field.type === "SYSTEM_USER" ||
      field.type === "FORMULA"
    ) {
      continue;
    }

    // Check required fields
    if (field.required && (value === undefined || value === null || value === "")) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `字段 "${field.label}" 是必填项`,
        },
      };
    }

    // Skip validation for empty optional fields
    if (value === undefined || value === null || value === "") {
      continue;
    }

    // Type validation
    switch (field.type) {
      case "NUMBER":
        if (typeof value !== "number" && isNaN(Number(value))) {
          return {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: `字段 "${field.label}" 必须是数字`,
            },
          };
        }
        break;

      case "EMAIL":
        if (typeof value === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: `字段 "${field.label}" 必须是有效的邮箱地址`,
            },
          };
        }
        break;

      case "SELECT":
        if (Array.isArray(field.options) && !field.options.includes(String(value))) {
          return {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: `字段 "${field.label}" 的值必须是选项之一`,
            },
          };
        }
        break;

      case "MULTISELECT":
        if (Array.isArray(field.options) && Array.isArray(value)) {
          const invalidOptions = value.filter((v) => !(field.options as string[]).includes(String(v)));
          if (invalidOptions.length > 0) {
            return {
              success: false,
              error: {
                code: "VALIDATION_ERROR",
                message: `字段 "${field.label}" 包含无效选项`,
              },
            };
          }
        }
        break;

      case "URL":
        if (typeof value === "string" && value !== "" && !/^https?:\/\/.+/.test(value)) {
          return {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: `字段 "${field.label}" 必须是有效的 URL（以 http:// 或 https:// 开头）`,
            },
          };
        }
        break;

      case "BOOLEAN":
        if (typeof value !== "boolean" && value !== "true" && value !== "false" && value !== 1 && value !== 0) {
          return {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: `字段 "${field.label}" 必须是布尔值`,
            },
          };
        }
        break;
    }
  }

  return { success: true, data: true };
}

// ── Relation Resolution ──

export async function resolveRelations(
  record: DataRecordItem,
  fields: DataFieldItem[]
): Promise<ServiceResult<Record<string, unknown>>> {
  try {
    const resolvedData = { ...record.data };

    for (const field of fields) {
      if (field.type === "RELATION" && field.relationTo && field.displayField) {
        const relationId = record.data[field.key];
        if (relationId && typeof relationId === "string") {
          // Fetch the related record
          const relatedRecord = await db.dataRecord.findUnique({
            where: { id: relationId },
          });

          if (relatedRecord) {
            const relatedData = relatedRecord.data as Record<string, unknown>;
            resolvedData[`${field.key}_display`] = relatedData[field.displayField];
          }
        }
      }
    }

    return { success: true, data: resolvedData };
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析关联字段失败";
    return { success: false, error: { code: "RESOLVE_RELATIONS_FAILED", message } };
  }
}

// ── Summary / Aggregation ──

export async function computeSummary(
  tableId: string,
  filterConditions?: FilterGroup[],
  search?: string,
  aggregations?: Record<string, AggregateType>,
  fields?: DataFieldItem[]
): Promise<ServiceResult<Record<string, { value: number | string; type: AggregateType }>>> {
  try {
    const tableResult = await getTable(tableId);
    if (!tableResult.success) {
      return { success: false, error: tableResult.error };
    }

    const resolvedFields = fields ?? tableResult.data.fields;
    if (!aggregations || Object.keys(aggregations).length === 0) {
      return { success: true, data: {} };
    }

    // Build where clause reusing existing filter logic
    const conditions: Record<string, unknown>[] = [{ tableId }];

    if (filterConditions && filterConditions.length > 0) {
      const normalized = normalizeFilters(filterConditions);
      for (const group of normalized) {
        const groupConds = group.conditions
          .map((cond) => buildConditionFromFilter(cond, resolvedFields))
          .filter(Boolean) as Record<string, unknown>[];
        if (groupConds.length > 0) {
          if (group.operator === "OR") {
            conditions.push({ OR: groupConds });
          } else {
            conditions.push(...groupConds);
          }
        }
      }
    }

    // Search (OR across text-type fields only)
    if (search) {
      const searchFields = resolvedFields.filter(
        (f) =>
          f.type === "TEXT" || f.type === "EMAIL" || f.type === "SELECT" ||
          f.type === "PHONE" || f.type === "MULTISELECT" || f.type === "URL"
      );
      if (searchFields.length > 0) {
        conditions.push({
          OR: searchFields.map((f) => ({
            data: { path: [f.key], string_contains: search },
          })),
        });
      }
    }

    const where = conditions.length > 1 ? { AND: conditions } : conditions[0];

    // Get count efficiently
    const count = await db.dataRecord.count({ where });

    // Get data for field-specific aggregates
    const records = await db.dataRecord.findMany({
      where,
      select: { data: true },
    });

    const data: Record<string, { value: number | string; type: AggregateType }> = {};

    for (const [fieldKey, aggType] of Object.entries(aggregations)) {
      const values = records
        .map((r) => (r.data as Record<string, unknown>)[fieldKey])
        .filter((v) => v !== null && v !== undefined && v !== "");

      const numValues = values.map(Number);
      let value: number | string = 0;

      switch (aggType) {
        case "count":
          value = count;
          break;
        case "sum":
          value = numValues.reduce((s, v) => s + (isNaN(v) ? 0 : v), 0);
          break;
        case "avg":
          value = numValues.length > 0
            ? numValues.reduce((s, v) => s + (isNaN(v) ? 0 : v), 0) / numValues.length
            : 0;
          break;
        case "min":
          value = values.length > 0 ? Math.min(...values.map(Number)) : 0;
          break;
        case "max":
          value = values.length > 0 ? Math.max(...values.map(Number)) : 0;
          break;
        case "earliest":
          if (values.length > 0) {
            const dates = values.map(v => new Date(String(v)).getTime()).filter(t => !isNaN(t));
            value = dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : "-";
          } else {
            value = "-";
          }
          break;
        case "latest":
          if (values.length > 0) {
            const dates = values.map(v => new Date(String(v)).getTime()).filter(t => !isNaN(t));
            value = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : "-";
          } else {
            value = "-";
          }
          break;
        case "checked":
          value = values.filter((v) => v === true || v === 1 || v === "true").length;
          break;
        case "unchecked":
          value = values.filter((v) => v !== true && v !== 1 && v !== "true").length;
          break;
      }

      data[fieldKey] = { value, type: aggType };
    }

    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "汇总计算失败";
    return { success: false, error: { code: "SUMMARY_FAILED", message } };
  }
}
