import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { getTable } from "./data-table.service";
import { findByUniqueField, createRecord, updateRecord } from "./data-record.service";
import type {
  ServiceResult,
  ImportPreview,
  ImportResult,
  FieldMapping,
  DataFieldItem,
} from "@/types/data-table";
import type { ImportOptionsInput } from "@/validators/data-table";

// ── Excel Parsing ──

export async function parseExcel(
  buffer: Buffer
): Promise<ServiceResult<ImportPreview>> {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });

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
        record[col] = row[index];
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
  tableId: string,
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
  fields: DataFieldItem[]
): Promise<ServiceResult<ImportResult>> {
  try {
    const result: ImportResult = {
      success: true,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Map Excel columns to field keys
      const mappedData: Record<string, unknown> = {};
      for (const [excelCol, fieldKey] of Object.entries(mapping)) {
        if (fieldKey && row[excelCol] !== undefined) {
          mappedData[fieldKey] = row[excelCol];
        }
      }

      // Check for duplicate
      const uniqueValue = mappedData[options.uniqueField];
      if (uniqueValue !== undefined) {
        const existingResult = await findByUniqueField(
          tableId,
          options.uniqueField,
          uniqueValue
        );

        if (existingResult.success && existingResult.data) {
          if (options.strategy === "skip") {
            result.skipped++;
            continue;
          } else if (options.strategy === "overwrite") {
            const updateResult = await updateRecord(
              existingResult.data.id,
              mappedData
            );
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
