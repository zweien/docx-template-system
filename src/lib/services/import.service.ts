import * as XLSX from "xlsx";
import * as nocodb from "@/lib/nocodb";
import type {
  ServiceResult,
  ImportPreview,
  ImportResult,
} from "@/types/data-table";

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

// ── Import to NocoDB table ──

export async function importData(
  tableId: string,
  _userId: string,
  rows: Record<string, unknown>[],
  mapping: Record<string, string | null>,
  _options: { uniqueField: string; strategy: "skip" | "overwrite" },
  _fields: Array<{ key: string; type: string }>,
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

      // Create record via NocoDB
      try {
        await nocodb.createRecord(tableId, mappedData);
        result.created++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "创建记录失败";
        result.errors.push({ row: i + 2, message });
      }
    }

    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "导入数据失败";
    return { success: false, error: { code: "IMPORT_ERROR", message } };
  }
}
