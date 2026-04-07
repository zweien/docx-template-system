import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { getTable } from "./data-table.service";
import type { ServiceResult, DataFieldItem } from "@/types/data-table";

// ── Shared Types ──

export interface TableExportData {
  table: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    businessKeys: string[];
  };
  fields: DataFieldItem[];
  records: Array<{
    id: string;
    data: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

// ── Shared Data Fetcher ──

export async function getTableExportData(
  tableId: string
): Promise<ServiceResult<TableExportData>> {
  const tableResult = await getTable(tableId);
  if (!tableResult.success) {
    return { success: false, error: tableResult.error };
  }

  const table = tableResult.data;

  const records = await db.dataRecord.findMany({
    where: { tableId },
    orderBy: { createdAt: "asc" },
  });

  return {
    success: true,
    data: {
      table: {
        id: table.id,
        name: table.name,
        description: table.description,
        icon: table.icon,
        businessKeys: table.businessKeys ?? [],
      },
      fields: table.fields,
      records: records.map((r) => ({
        id: r.id,
        data: r.data as Record<string, unknown>,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    },
  };
}

// ── Legacy Record Export ──

export function exportRecordToExcel(
  formData: Record<string, unknown>,
  placeholders: { key: string; label: string }[],
  _templateName: string
): Buffer {
  const wb = XLSX.utils.book_new();

  // Build headers (label) and values (from formData keyed by key)
  const headers: string[] = [];
  const values: string[] = [];

  for (const ph of placeholders) {
    headers.push(ph.label || ph.key);
    const val = formData[ph.key];
    if (Array.isArray(val)) {
      values.push(JSON.stringify(val));
    } else {
      values.push(String(val ?? ""));
    }
  }

  // Include any formData keys not in placeholders
  const knownKeys = new Set(placeholders.map((p) => p.key));
  for (const key of Object.keys(formData)) {
    if (!knownKeys.has(key)) {
      headers.push(key);
      const val = formData[key];
      if (Array.isArray(val)) {
        values.push(JSON.stringify(val));
      } else {
        values.push(String(val ?? ""));
      }
    }
  }

  // Create worksheet
  const wsData = [headers, values];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length * 2, 12) }));

  XLSX.utils.book_append_sheet(wb, ws, "表单数据");

  // Write to buffer
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buffer);
}

// ── Excel Export ──

export async function exportToExcel(
  tableId: string
): Promise<ServiceResult<Buffer>> {
  try {
    const dataResult = await getTableExportData(tableId);
    if (!dataResult.success) {
      return { success: false, error: dataResult.error };
    }

    const { table, fields, records } = dataResult.data;

    const headers = fields.map((f) => f.label);
    const rows = records.map((record) => {
      const data = record.data;
      return fields.map((f) => {
        const value = data[f.key];
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

// ── JSON Export ──

export interface ExportJSON {
  version: string;
  exportedAt: string;
  table: {
    name: string;
    description: string | null;
    icon: string | null;
    businessKeys: string[];
  };
  fields: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    sortOrder: number;
    options: unknown;
    defaultValue: string | null;
    relationTo?: string;
    relationCardinality?: string | null;
  }>;
  records: Record<string, unknown>[];
}

export async function exportToJSON(
  tableId: string
): Promise<ServiceResult<ExportJSON>> {
  try {
    const dataResult = await getTableExportData(tableId);
    if (!dataResult.success) {
      return { success: false, error: dataResult.error };
    }

    const { table, fields, records } = dataResult.data;

    const exportFields = fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      sortOrder: f.sortOrder,
      options: f.options ?? null,
      defaultValue: f.defaultValue ?? null,
      ...(f.type === "RELATION" || f.type === "RELATION_SUBTABLE"
        ? {
            relationTo: f.relationTo,
            relationCardinality: f.relationCardinality,
          }
        : {}),
    }));

    const exportRecords = records.map((r) => r.data);

    return {
      success: true,
      data: {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        table: {
          name: table.name,
          description: table.description,
          icon: table.icon,
          businessKeys: table.businessKeys,
        },
        fields: exportFields,
        records: exportRecords,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "导出 JSON 失败";
    return { success: false, error: { code: "EXPORT_JSON_ERROR", message } };
  }
}
