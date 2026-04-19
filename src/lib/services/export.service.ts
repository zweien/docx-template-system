import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { getTable } from "./data-table.service";
import type { ServiceResult, DataFieldItem, ExportBundle, BundleField, BundleTable } from "@/types/data-table";

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

// ── SQL Export ──

export async function exportToSQL(
  tableId: string
): Promise<ServiceResult<string>> {
  try {
    const dataResult = await getTableExportData(tableId);
    if (!dataResult.success) {
      return { success: false, error: dataResult.error };
    }

    const { table, fields, records } = dataResult.data;

    const lines: string[] = [];
    lines.push(`-- 数据表: ${table.name}`);
    lines.push(`-- 导出时间: ${new Date().toISOString()}`);
    lines.push(
      `-- 字段定义: ${fields.map((f) => `${f.key}(${f.type})`).join(", ")}`
    );
    lines.push("");

    if (records.length === 0) {
      lines.push("-- 无记录数据");
      return { success: true, data: lines.join("\n") };
    }

    const values = records.map((r) => {
      const dataStr = JSON.stringify(r.data).replace(/'/g, "''");
      const id = r.id.replace(/'/g, "''");
      return `('${id}', '${table.id}', '${dataStr}', '${r.createdAt.toISOString()}', '${r.updatedAt.toISOString()}')`;
    });

    lines.push(
      `INSERT INTO "DataRecord" ("id", "tableId", "data", "createdAt", "updatedAt") VALUES`
    );
    lines.push(values.join(",\n") + ";");

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    const message = error instanceof Error ? error.message : "导出 SQL 失败";
    return { success: false, error: { code: "EXPORT_SQL_ERROR", message } };
  }
}

// ── Bundle Export (multi-table with relations) ──

export async function exportBundle(
  rootTableId: string
): Promise<ServiceResult<ExportBundle>> {
  try {
    // Phase 1: BFS to collect all related table IDs
    const visited = new Set<string>();
    const queue = [rootTableId];
    const tableDataMap = new Map<string, TableExportData>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const dataResult = await getTableExportData(currentId);
      if (!dataResult.success) {
        return { success: false, error: dataResult.error };
      }
      tableDataMap.set(currentId, dataResult.data);

      // Traverse relation fields to find related tables
      for (const field of dataResult.data.fields) {
        if (
          (field.type === "RELATION" || field.type === "RELATION_SUBTABLE") &&
          field.relationTo &&
          !field.isSystemManagedInverse &&
          !visited.has(field.relationTo)
        ) {
          queue.push(field.relationTo);
        }
      }
    }

    // Phase 2: Build record lookup maps (recordId -> businessKey values) per table
    const recordLookupByTable = new Map<string, Map<string, Record<string, unknown>>>();

    for (const [tableId, data] of tableDataMap) {
      const bks = data.table.businessKeys;
      const lookup = new Map<string, Record<string, unknown>>();
      for (const record of data.records) {
        const bkValues: Record<string, unknown> = {};
        for (const bk of bks) {
          bkValues[bk] = record.data[bk];
        }
        lookup.set(record.id, bkValues);
      }
      recordLookupByTable.set(tableId, lookup);
    }

    // Phase 3: Build id->name mapping for tables
    const tableIdToName = new Map<string, string>();
    for (const [, data] of tableDataMap) {
      tableIdToName.set(data.table.id, data.table.name);
    }

    // Phase 4: Map each table to BundleTable
    const tables: Record<string, BundleTable> = {};

    for (const [_tableId, data] of tableDataMap) {
      const _relFieldKeys = new Set(
        data.fields
          .filter((f) => f.type === "RELATION" || f.type === "RELATION_SUBTABLE")
          .map((f) => f.key)
      );

      // Fields: exclude system-managed inverse fields, replace relationTo with table name
      const bundleFields: BundleField[] = data.fields
        .filter((f) => !f.isSystemManagedInverse)
        .map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type as string,
          required: f.required,
          sortOrder: f.sortOrder,
          options: f.options ?? null,
          defaultValue: f.defaultValue ?? null,
          ...(f.type === "RELATION" || f.type === "RELATION_SUBTABLE"
            ? {
                relationTo: f.relationTo ? (tableIdToName.get(f.relationTo) ?? f.relationTo) : null,
                displayField: f.displayField ?? null,
                relationCardinality: f.relationCardinality ?? null,
                inverseRelationCardinality: f.inverseRelationCardinality ?? null,
                relationSchema: f.relationSchema ?? null,
              }
            : {}),
        }));

      // Records: make relation values portable
      const bundleRecords = data.records.map((record) => {
        const portable: Record<string, unknown> = { ...record.data };

        for (const field of data.fields) {
          if (
            (field.type !== "RELATION" && field.type !== "RELATION_SUBTABLE") ||
            field.isSystemManagedInverse
          ) {
            continue;
          }

          const value = portable[field.key];
          if (value === undefined || value === null) continue;

          if (field.type === "RELATION") {
            // Single relation: value is a target record ID string
            const targetTableId = field.relationTo;
            if (targetTableId) {
              const lookup = recordLookupByTable.get(targetTableId);
              const bkValues = lookup?.get(value as string);
              portable[field.key] = bkValues
                ? { _ref: bkValues }
                : null;
            }
          } else if (field.type === "RELATION_SUBTABLE") {
            // Array of RelationSubtableValueItem
            const items = value as Array<{
              targetRecordId: string;
              displayValue?: string;
              attributes: Record<string, unknown>;
              sortOrder: number;
            }>;

            const targetTableId = field.relationTo;
            const lookup = targetTableId ? recordLookupByTable.get(targetTableId) : undefined;

            portable[field.key] = items.map((item) => {
              const bkValues = lookup?.get(item.targetRecordId);
              return {
                ...(bkValues ? { _ref: bkValues } : {}),
                displayValue: item.displayValue,
                attributes: item.attributes,
                sortOrder: item.sortOrder,
              };
            });
          }
        }

        return portable;
      });

      tables[data.table.name] = {
        name: data.table.name,
        description: data.table.description,
        icon: data.table.icon,
        businessKeys: data.table.businessKeys,
        fields: bundleFields,
        records: bundleRecords,
      };
    }

    const rootData = tableDataMap.get(rootTableId)!;

    return {
      success: true,
      data: {
        version: "2.0",
        exportedAt: new Date().toISOString(),
        rootTable: rootData.table.name,
        tables,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "导出关联数据失败";
    return { success: false, error: { code: "EXPORT_BUNDLE_ERROR", message } };
  }
}
