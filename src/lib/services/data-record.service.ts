import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type {
  DataRecordItem,
  PaginatedRecords,
  ServiceResult,
  DataFieldItem,
} from "@/types/data-table";
import { getTable } from "./data-table.service";

// Helper to convert Record<string, unknown> to Prisma JSON input
function toJsonInput(data: Record<string, unknown>): Prisma.InputJsonValue {
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
}): DataRecordItem {
  return {
    id: row.id,
    tableId: row.tableId,
    data: row.data as Record<string, unknown>,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByName: row.createdBy.name,
  };
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
        .filter(f => f.type === "TEXT" || f.type === "TEXTAREA" || f.type === "EMAIL" || f.type === "SELECT")
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

    const [records, total] = await Promise.all([
      db.dataRecord.findMany({
        where,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { name: true } },
        },
      }),
      db.dataRecord.count({ where }),
    ]);

    return {
      success: true,
      data: {
        records: records.map(mapRecordToItem),
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

    const record = await db.dataRecord.create({
      data: {
        tableId,
        data: toJsonInput(data),
        createdById: userId,
      },
      include: {
        createdBy: { select: { name: true } },
      },
    });

    return { success: true, data: mapRecordToItem(record) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建记录失败";
    return { success: false, error: { code: "CREATE_FAILED", message } };
  }
}

export async function updateRecord(
  id: string,
  data: Record<string, unknown>
): Promise<ServiceResult<DataRecordItem>> {
  try {
    // Get existing record to find tableId
    const existingRecord = await db.dataRecord.findUnique({
      where: { id },
    });

    if (!existingRecord) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "记录不存在" },
      };
    }

    // Get table and validate data against fields
    const tableResult = await getTable(existingRecord.tableId);
    if (!tableResult.success) {
      return { success: false, error: tableResult.error };
    }

    const validation = validateRecordData(data, tableResult.data.fields);
    if (!validation.success) {
      return validation;
    }

    const record = await db.dataRecord.update({
      where: { id },
      data: { data: toJsonInput(data) },
      include: {
        createdBy: { select: { name: true } },
      },
    });

    return { success: true, data: mapRecordToItem(record) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新记录失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}

export async function deleteRecord(id: string): Promise<ServiceResult<null>> {
  try {
    const record = await db.dataRecord.findUnique({ where: { id } });

    if (!record) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "记录不存在" },
      };
    }

    await db.dataRecord.delete({ where: { id } });

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

// ── Validation ──

function validateRecordData(
  data: Record<string, unknown>,
  fields: DataFieldItem[]
): ServiceResult<boolean> {
  for (const field of fields) {
    const value = data[field.key];

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
        if (field.options && !field.options.includes(String(value))) {
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
        if (field.options && Array.isArray(value)) {
          const invalidOptions = value.filter((v) => !field.options!.includes(String(v)));
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
