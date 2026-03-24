import * as XLSX from "xlsx";

export function exportRecordToExcel(
  formData: Record<string, unknown>,
  placeholders: { key: string; label: string }[],
  templateName: string
): Buffer {
  const wb = XLSX.utils.book_new();

  // Build headers (label) and values (from formData keyed by key)
  const headers: string[] = [];
  const values: string[] = [];

  for (const ph of placeholders) {
    headers.push(ph.label || ph.key);
    values.push(String(formData[ph.key] ?? ""));
  }

  // Include any formData keys not in placeholders
  const knownKeys = new Set(placeholders.map((p) => p.key));
  for (const key of Object.keys(formData)) {
    if (!knownKeys.has(key)) {
      headers.push(key);
      values.push(String(formData[key] ?? ""));
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
