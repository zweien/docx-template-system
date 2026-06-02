import * as XLSX from "xlsx";
import * as nocodb from "@/lib/nocodb";
import type { ServiceResult } from "@/types/data-table";

// ── Legacy Record Export (unchanged - used by template form data export) ──

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

// ── NocoDB-based table export ──

export async function exportToExcel(
  tableId: string,
  options?: { visibleFields?: string[]; fieldOrder?: string[] },
  selectedIds?: string[]
): Promise<ServiceResult<Buffer>> {
  try {
    const detail = await nocodb.getTableDetail(tableId);
    const result = await nocodb.listRecords(tableId, { pageSize: 1000 });

    const fields = detail.fields;
    let exportFields = fields;
    if (options?.visibleFields) {
      const visibleSet = new Set(options.visibleFields);
      exportFields = fields.filter((f) => visibleSet.has(f.key));
    }

    const headers = exportFields.map((field) => field.label);
    let records = result.records;

    if (selectedIds && selectedIds.length > 0) {
      const idSet = new Set(selectedIds.map(String));
      records = records.filter((r) => idSet.has(String(r.id)));
    }

    const rows = records.map((record) => {
      return exportFields.map((field) => {
        const val = record.data[field.key];
        return val === null || val === undefined ? "" : String(val);
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, detail.name);

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return { success: true, data: Buffer.from(buffer) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "导出数据失败";
    return { success: false, error: { code: "EXPORT_ERROR", message } };
  }
}
