import { db } from "@/lib/db";
import { FieldType } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import type {
  DataTableListItem,
  DataTableDetail,
  DataFieldItem,
  ServiceResult,
} from "@/types/data-table";
import type { CreateTableInput, UpdateTableInput, DataFieldInput } from "@/validators/data-table";

// Helper to convert to Prisma JSON input
function toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

// ── Helpers ──

function mapFieldToItem(row: {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: unknown;
  relationTo: string | null;
  displayField: string | null;
  defaultValue: string | null;
  sortOrder: number;
}): DataFieldItem {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    required: row.required,
    options: row.options as string[] | undefined,
    relationTo: row.relationTo ?? undefined,
    displayField: row.displayField ?? undefined,
    defaultValue: row.defaultValue ?? undefined,
    sortOrder: row.sortOrder,
  };
}

// ── Table Management ──

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

export async function getTable(id: string): Promise<ServiceResult<DataTableDetail>> {
  try {
    const table = await db.dataTable.findUnique({
      where: { id },
      include: {
        fields: { orderBy: { sortOrder: "asc" } },
        _count: {
          select: { records: true },
        },
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
        icon: table.icon,
        fieldCount: table.fields.length,
        recordCount: table._count.records,
        createdAt: table.createdAt,
        fields: table.fields.map(mapFieldToItem),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取数据表详情失败";
    return { success: false, error: { code: "GET_FAILED", message } };
  }
}

export async function createTable(
  userId: string,
  data: CreateTableInput
): Promise<ServiceResult<DataTableDetail>> {
  try {
    // Check if table name already exists
    const existing = await db.dataTable.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      return {
        success: false,
        error: { code: "DUPLICATE_NAME", message: "数据表名称已存在" },
      };
    }

    const table = await db.dataTable.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        icon: data.icon ?? null,
        createdById: userId,
      },
      include: {
        fields: true,
        _count: {
          select: { records: true },
        },
      },
    });

    return {
      success: true,
      data: {
        id: table.id,
        name: table.name,
        description: table.description,
        icon: table.icon,
        fieldCount: 0,
        recordCount: 0,
        createdAt: table.createdAt,
        fields: [],
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建数据表失败";
    return { success: false, error: { code: "CREATE_FAILED", message } };
  }
}

export async function updateTable(
  id: string,
  data: UpdateTableInput
): Promise<ServiceResult<DataTableDetail>> {
  try {
    // Check if new name conflicts with existing table
    if (data.name) {
      const existing = await db.dataTable.findFirst({
        where: {
          name: data.name,
          NOT: { id },
        },
      });

      if (existing) {
        return {
          success: false,
          error: { code: "DUPLICATE_NAME", message: "数据表名称已存在" },
        };
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.icon !== undefined) updateData.icon = data.icon;

    const table = await db.dataTable.update({
      where: { id },
      data: updateData,
      include: {
        fields: { orderBy: { sortOrder: "asc" } },
        _count: {
          select: { records: true },
        },
      },
    });

    return {
      success: true,
      data: {
        id: table.id,
        name: table.name,
        description: table.description,
        icon: table.icon,
        fieldCount: table.fields.length,
        recordCount: table._count.records,
        createdAt: table.createdAt,
        fields: table.fields.map(mapFieldToItem),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新数据表失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}

export async function deleteTable(id: string): Promise<ServiceResult<null>> {
  try {
    const table = await db.dataTable.findUnique({ where: { id } });

    if (!table) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "数据表不存在" },
      };
    }

    // Cascade delete will handle fields and records
    await db.dataTable.delete({ where: { id } });

    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除数据表失败";
    return { success: false, error: { code: "DELETE_FAILED", message } };
  }
}

// ── Field Management ──

export async function updateFields(
  tableId: string,
  fields: DataFieldInput[]
): Promise<ServiceResult<DataFieldItem[]>> {
  try {
    // Validate fields
    const validationResult = validateFields(fields);
    if (!validationResult.success) {
      return validationResult;
    }

    // Use transaction to replace all fields
    const result = await db.$transaction(async (tx) => {
      // Delete existing fields
      await tx.dataField.deleteMany({ where: { tableId } });

      // Create new fields
      await tx.dataField.createMany({
        data: fields.map((f, index) => ({
          tableId,
          key: f.key,
          label: f.label,
          type: f.type as FieldType,
          required: f.required ?? false,
          options: toJsonInput(f.options),
          relationTo: f.relationTo ?? null,
          displayField: f.displayField ?? null,
          defaultValue: f.defaultValue ?? null,
          sortOrder: f.sortOrder ?? index,
        })),
      });

      // Fetch created fields
      return tx.dataField.findMany({
        where: { tableId },
        orderBy: { sortOrder: "asc" },
      });
    });

    return {
      success: true,
      data: result.map(mapFieldToItem),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新字段配置失败";
    return { success: false, error: { code: "UPDATE_FIELDS_FAILED", message } };
  }
}

export function validateFields(fields: DataFieldInput[]): ServiceResult<boolean> {
  // Check for duplicate keys
  const keys = fields.map((f) => f.key);
  const uniqueKeys = new Set(keys);
  if (keys.length !== uniqueKeys.size) {
    return {
      success: false,
      error: { code: "DUPLICATE_KEYS", message: "存在重复的字段标识" },
    };
  }

  // Validate SELECT/MULTISELECT have options
  for (const field of fields) {
    if ((field.type === "SELECT" || field.type === "MULTISELECT") && (!field.options || field.options.length === 0)) {
      return {
        success: false,
        error: {
          code: "MISSING_OPTIONS",
          message: `字段 "${field.label}" 是单选/多选类型，必须提供选项列表`,
        },
      };
    }

    // Validate RELATION has relationTo and displayField
    if (field.type === "RELATION") {
      if (!field.relationTo) {
        return {
          success: false,
          error: {
            code: "MISSING_RELATION_TO",
            message: `字段 "${field.label}" 是关联类型，必须指定关联表`,
          },
        };
      }
      if (!field.displayField) {
        return {
          success: false,
          error: {
            code: "MISSING_DISPLAY_FIELD",
            message: `字段 "${field.label}" 是关联类型，必须指定显示字段`,
          },
        };
      }
    }
  }

  return { success: true, data: true };
}

// ── Utility Functions ──

export async function checkTableExists(id: string): Promise<boolean> {
  const table = await db.dataTable.findUnique({ where: { id } });
  return !!table;
}
