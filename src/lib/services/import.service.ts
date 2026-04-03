import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { getTable } from "./data-table.service";
import { findByUniqueField, createRecord, updateRecord } from "./data-record.service";
import { syncRelationSubtableValues } from "./data-relation.service";
import type {
  ServiceResult,
  ImportPreview,
  ImportResult,
  FieldMapping,
  DataFieldItem,
  RelationSubtableValueItem,
} from "@/types/data-table";
import type { ImportOptionsInput } from "@/validators/data-table";
import { FieldType } from "@/generated/prisma/enums";

// ── Helpers ──

/**
 * Convert a raw Excel value to the appropriate format for a DATE field.
 * Handles: JS Date objects (from cellDates:true), Excel serial numbers, ISO strings.
 */
function toDateValue(value: unknown): string | unknown {
  if (value instanceof Date) {
    return value.toISOString().split("T")[0]; // "YYYY-MM-DD"
  }
  if (typeof value === "number") {
    // Excel serial number to date
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split("T")[0];
  }
  return value;
}

/**
 * Normalize an import value based on the target field type.
 */
function normalizeImportValue(value: unknown, fieldType: FieldType): unknown {
  if (fieldType === "DATE" && value !== null && value !== undefined && value !== "") {
    return toDateValue(value);
  }
  if (fieldType === "NUMBER" && typeof value === "string") {
    const num = Number(value);
    return isNaN(num) ? value : num;
  }
  return value;
}

// ── Excel Parsing ──

export async function parseExcel(
  buffer: Buffer
): Promise<ServiceResult<ImportPreview>> {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        error: { code: "EMPTY_FILE", message: "Excel 文件没有工作表" },
      };
    }

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
    }) as unknown as unknown[][];

    if (jsonData.length < 2) {
      return {
        success: false,
        error: { code: "NO_DATA", message: "Excel 文件没有数据或只有标题行" },
      };
    }

    // First row is headers
    const columns = jsonData[0].map(String);
    const rows = jsonData.slice(1, 6).map((row) => {
      const record: Record<string, unknown> = {};
      columns.forEach((col, index) => {
        const val = row[index];
        record[col] = val instanceof Date ? val.toISOString().split("T")[0] : val;
      });
      return record;
    });

    return {
      success: true,
      data: {
        columns,
        rows,
        totalRows: jsonData.length - 1,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析 Excel 文件失败";
    return { success: false, error: { code: "PARSE_ERROR", message } };
  }
}

// ── Validation ──

export async function validateImportData(
  _tableId: string,
  rows: Record<string, unknown>[],
  mapping: FieldMapping,
  fields: DataFieldItem[]
): Promise<
  ServiceResult<{
    valid: boolean;
    errors: Array<{ row: number; field: string; message: string }>;
  }>
> {
  const errors: Array<{ row: number; field: string; message: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    for (const field of fields) {
      const excelColumn = Object.keys(mapping).find(
        (k) => mapping[k] === field.key
      );
      if (!excelColumn) continue;

      const value = row[excelColumn];

      // Check required
      if (
        field.required &&
        (value === undefined || value === null || value === "")
      ) {
        errors.push({
          row: i + 2, // +2 because Excel starts at 1 and we skip header
          field: field.key,
          message: `${field.label} 是必填项`,
        });
        continue;
      }

      // Type validation
      if (value !== undefined && value !== null && value !== "") {
        switch (field.type) {
          case "NUMBER":
            if (typeof value !== "number" && isNaN(Number(value))) {
              errors.push({
                row: i + 2,
                field: field.key,
                message: `${field.label} 必须是数字`,
              });
            }
            break;
          case "EMAIL":
            if (
              typeof value === "string" &&
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
            ) {
              errors.push({
                row: i + 2,
                field: field.key,
                message: `${field.label} 必须是有效的邮箱地址`,
              });
            }
            break;
          case "SELECT":
            if (field.options && !field.options.includes(String(value))) {
              errors.push({
                row: i + 2,
                field: field.key,
                message: `${field.label} 的值 "${value}" 不是有效选项`,
              });
            }
            break;
        }
      }
    }
  }

  return {
    success: true,
    data: {
      valid: errors.length === 0,
      errors,
    },
  };
}

// ── Import ──

export async function importData(
  tableId: string,
  userId: string,
  rows: Record<string, unknown>[],
  mapping: FieldMapping,
  options: ImportOptionsInput,
  _fields: DataFieldItem[],
  importContext?: { businessKeys?: string[] }
): Promise<ServiceResult<ImportResult>> {
  try {
    const result: ImportResult = {
      success: true,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    const relationFieldKeys = new Set(
      _fields.filter((f) => f.type === "RELATION_SUBTABLE").map((f) => f.key)
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Map Excel columns to field keys with type normalization
      const mappedData: Record<string, unknown> = {};
      for (const [excelCol, fieldKey] of Object.entries(mapping)) {
        if (fieldKey && row[excelCol] !== undefined) {
          const field = _fields.find((f) => f.key === fieldKey);
          let value = row[excelCol];

          // Parse JSON strings for relation subtable fields
          if (relationFieldKeys.has(fieldKey) && typeof value === "string") {
            try {
              value = JSON.parse(value);
            } catch {
              // Keep as-is if not valid JSON
            }
          }

          mappedData[fieldKey] = field
            ? (relationFieldKeys.has(fieldKey) ? value : normalizeImportValue(value, field.type))
            : value;
        }
      }

      // Check for duplicate via business keys or single unique field
      let existingId: string | null = null;

      if (importContext?.businessKeys && importContext.businessKeys.length > 0) {
        const keyResult = await findRecordByBusinessKey(
          tableId,
          importContext.businessKeys,
          mappedData
        );
        if (!keyResult.success) {
          result.errors.push({ row: i + 2, message: keyResult.error.message });
          continue;
        }
        existingId = keyResult.data;
      } else {
        const uniqueValue = mappedData[options.uniqueField];
        if (uniqueValue !== undefined) {
          const existingResult = await findByUniqueField(
            tableId,
            options.uniqueField,
            uniqueValue
          );
          if (existingResult.success && existingResult.data) {
            existingId = existingResult.data.id;
          }
        }
      }

      if (existingId) {
        if (options.strategy === "skip") {
          result.skipped++;
          continue;
        } else if (options.strategy === "overwrite") {
          const updateResult = await updateRecord(existingId, mappedData);
          if (updateResult.success) {
            result.updated++;
          } else {
            result.errors.push({
              row: i + 2,
              message: updateResult.error.message,
            });
          }
          continue;
        }
      }

      // Create new record
      const createResult = await createRecord(userId, tableId, mappedData);
      if (createResult.success) {
        result.created++;
      } else {
        result.errors.push({
          row: i + 2,
          message: createResult.error.message,
        });
      }
    }

    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "导入数据失败";
    return { success: false, error: { code: "IMPORT_ERROR", message } };
  }
}

// ── Export ──

// ── Business Key Lookup ──

export async function findRecordByBusinessKey(
  tableId: string,
  businessKeys: string[],
  row: Record<string, unknown>
): Promise<ServiceResult<string | null>> {
  if (businessKeys.length === 0) {
    return { success: true, data: null };
  }

  const andConditions = businessKeys.map((key) => ({
    data: { path: [key], equals: JSON.parse(JSON.stringify(row[key])) },
  }));

  const records = await db.dataRecord.findMany({
    where: { tableId, AND: andConditions },
  });

  if (records.length > 1) {
    return {
      success: false,
      error: {
        code: "AMBIGUOUS_BUSINESS_KEY",
        message: `业务唯一键 [${businessKeys.join(", ")}] 匹配到多条记录`,
      },
    };
  }

  return { success: true, data: records[0]?.id ?? null };
}

// ── Relation Detail Import ──

export interface RelationDetailImportInput {
  tableId: string;
  relationFieldKey: string;
  userId: string;
  rows: Record<string, unknown>[];
  sourceMapping: Record<string, string>;
  targetMapping: Record<string, string>;
  attributeMapping: Record<string, string>;
  sourceBusinessKeys: string[];
  targetBusinessKeys: string[];
  targetTableId: string;
}

export async function importRelationDetails(
  input: RelationDetailImportInput
): Promise<ServiceResult<ImportResult>> {
  try {
    const tableResult = await getTable(input.tableId);
    if (!tableResult.success) {
      return { success: false, error: tableResult.error };
    }

    const relationField = tableResult.data.fields.find(
      (f) => f.key === input.relationFieldKey && f.type === "RELATION_SUBTABLE"
    );
    if (!relationField) {
      return {
        success: false,
        error: {
          code: "FIELD_NOT_FOUND",
          message: `关系字段 "${input.relationFieldKey}" 不存在`,
        },
      };
    }

    const result: ImportResult = {
      success: true,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    // Group rows by source record business key values
    const sourceGroups = new Map<string, { rowIndex: number; row: Record<string, unknown> }[]>();
    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i];
      const sourceKey = input.sourceBusinessKeys
        .map((bk) => {
          const excelCol = Object.keys(input.sourceMapping).find(
            (col) => input.sourceMapping[col] === bk
          );
          return String(row[excelCol ?? bk] ?? "");
        })
        .join("|");

      const group = sourceGroups.get(sourceKey) ?? [];
      group.push({ rowIndex: i, row });
      sourceGroups.set(sourceKey, group);
    }

    // Process each source group
    for (const [, group] of sourceGroups) {
      // Resolve source record by business keys
      const sourceRow: Record<string, unknown> = {};
      for (const [excelCol, fieldKey] of Object.entries(input.sourceMapping)) {
        if (fieldKey && group[0].row[excelCol] !== undefined) {
          sourceRow[fieldKey] = group[0].row[excelCol];
        }
      }

      const sourceResult = await findRecordByBusinessKey(
        input.tableId,
        input.sourceBusinessKeys,
        sourceRow
      );

      if (!sourceResult.success) {
        for (const { rowIndex } of group) {
          result.errors.push({ row: rowIndex + 2, message: sourceResult.error.message });
        }
        continue;
      }

      if (!sourceResult.data) {
        for (const { rowIndex } of group) {
          result.errors.push({
            row: rowIndex + 2,
            message: "未找到匹配的源记录",
          });
        }
        continue;
      }

      // Resolve target records and build relation items
      const relationItems: RelationSubtableValueItem[] = [];
      for (const { rowIndex, row } of group) {
        const targetRow: Record<string, unknown> = {};
        for (const [excelCol, fieldKey] of Object.entries(input.targetMapping)) {
          if (fieldKey && row[excelCol] !== undefined) {
            targetRow[fieldKey] = row[excelCol];
          }
        }

        const targetResult = await findRecordByBusinessKey(
          input.targetTableId,
          input.targetBusinessKeys,
          targetRow
        );

        if (!targetResult.success) {
          result.errors.push({ row: rowIndex + 2, message: targetResult.error.message });
          continue;
        }

        if (!targetResult.data) {
          result.errors.push({ row: rowIndex + 2, message: "未找到匹配的目标记录" });
          continue;
        }

        const attributes: Record<string, unknown> = {};
        for (const [excelCol, attrKey] of Object.entries(input.attributeMapping)) {
          if (attrKey && row[excelCol] !== undefined) {
            attributes[attrKey] = row[excelCol];
          }
        }

        relationItems.push({
          targetRecordId: targetResult.data,
          attributes,
          sortOrder: relationItems.length,
        });
      }

      if (relationItems.length === 0) continue;

      // Sync relations via the relation service
      // We need to run within a transaction context, so use db.$transaction
      try {
        await db.$transaction(async (tx) => {
          const syncResult = await syncRelationSubtableValues({
            tx,
            sourceRecordId: sourceResult.data!,
            tableId: input.tableId,
            relationPayload: {
              [input.relationFieldKey]: relationItems,
            },
          });
          if (!syncResult.success) {
            throw new Error(`${syncResult.error.code}:${syncResult.error.message}`);
          }
        });
        result.created += relationItems.length;
      } catch (error) {
        const message = error instanceof Error ? error.message : "关系同步失败";
        for (const { rowIndex } of group) {
          result.errors.push({ row: rowIndex + 2, message });
        }
      }
    }

    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "导入关系明细失败";
    return { success: false, error: { code: "IMPORT_RELATION_ERROR", message } };
  }
}

// ── Export ──

export async function exportToExcel(
  tableId: string
): Promise<ServiceResult<Buffer>> {
  try {
    const tableResult = await getTable(tableId);
    if (!tableResult.success) {
      return { success: false, error: tableResult.error };
    }

    const table = tableResult.data;

    // Get all records
    const records = await db.dataRecord.findMany({
      where: { tableId },
      orderBy: { createdAt: "desc" },
    });

    // Build worksheet data
    const headers = table.fields.map((f) => f.label);
    const rows = records.map((record) => {
      const data = record.data as Record<string, unknown>;
      return table.fields.map((f) => {
        const value = data[f.key];
        // Handle special types
        if (f.type === "MULTISELECT" && Array.isArray(value)) {
          return value.join(", ");
        }
        return value ?? "";
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, table.name);

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return { success: true, data: Buffer.from(buffer) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "导出数据失败";
    return { success: false, error: { code: "EXPORT_ERROR", message } };
  }
}
