import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { getTable } from "./data-table.service";
import { findByUniqueField, createRecord, updateRecord } from "./data-record.service";
import { syncRelationSubtableValues } from "./data-relation.service";
import { updateFields } from "./data-table.service";
import type {
  ServiceResult,
  ImportPreview,
  ImportResult,
  FieldMapping,
  DataFieldItem,
  RelationSubtableValueItem,
  ExportBundle,
  BundleImportResult,
} from "@/types/data-table";
import type { DataFieldInput, ImportOptionsInput } from "@/validators/data-table";
import { FieldType } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";

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
  if (fieldType === "RATING" || fieldType === "CURRENCY" || fieldType === "PERCENTAGE") {
    if (typeof value === "string") {
      const num = Number(value);
      return isNaN(num) ? value : num;
    }
  }
  if (fieldType === "DURATION" && typeof value === "string") {
    const num = Number(value);
    if (!isNaN(num)) return Math.round(num);
    const parts = value.split(":").map(Number);
    if (parts.every((p) => !isNaN(p))) {
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
    }
    const num = Number(value);
    return isNaN(num) ? value : Math.round(num);
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
            if (Array.isArray(field.options) && !field.options.includes(String(value))) {
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
          const updateResult = await updateRecord(existingId, mappedData, userId);
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

// ── JSON Import ──

export async function importFromJSON(
  tableId: string,
  userId: string,
  jsonData: {
    version: string;
    fields: Array<{ key: string; label: string; type: string }>;
    records: Record<string, unknown>[];
  },
  options: { strategy: "skip" | "overwrite" },
  fields: DataFieldItem[]
): Promise<ServiceResult<ImportResult>> {
  // Validate version
  if (!jsonData.version) {
    return {
      success: false,
      error: { code: "INVALID_JSON", message: "缺少 version 字段" },
    };
  }

  if (!Array.isArray(jsonData.records)) {
    return {
      success: false,
      error: { code: "INVALID_JSON", message: "缺少 records 数组" },
    };
  }

  // Build mapping: JSON field keys map directly to table field keys
  const mapping: Record<string, string | null> = {};
  const fieldKeySet = new Set(fields.map((f) => f.key));
  for (const jsonField of jsonData.fields) {
    mapping[jsonField.key] = fieldKeySet.has(jsonField.key) ? jsonField.key : null;
  }

  // Use business keys from the table for dedup
  const tableResult = await getTable(tableId);
  const businessKeys = tableResult.success ? (tableResult.data.businessKeys ?? []) : [];

  // Delegate to importData
  return importData(tableId, userId, jsonData.records, mapping, {
    uniqueField: businessKeys[0] ?? fields[0]?.key ?? "",
    strategy: options.strategy,
  }, fields, { businessKeys });
}

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

// ── Import Table from JSON (create new table) ──

export interface ImportTableResult {
  tableId: string;
  tableName: string;
  fieldCount: number;
  recordCount: number;
  skippedRelationFields: string[];
}

export async function importTableFromJSON(
  userId: string,
  jsonData: {
    version: string;
    table: {
      name: string;
      description?: string | null;
      icon?: string | null;
      businessKeys?: string[];
    };
    fields: Array<{
      key: string;
      label: string;
      type: string;
      required?: boolean;
      sortOrder?: number;
      options?: unknown;
      defaultValue?: string | null;
      relationTo?: string;
      relationCardinality?: string | null;
    }>;
    records: Record<string, unknown>[];
  }
): Promise<ServiceResult<ImportTableResult>> {
  try {
    // Validate structure
    if (!jsonData.version) {
      return { success: false, error: { code: "INVALID_JSON", message: "缺少 version 字段" } };
    }
    if (!jsonData.table?.name) {
      return { success: false, error: { code: "INVALID_JSON", message: "缺少 table.name 字段" } };
    }
    if (!Array.isArray(jsonData.fields) || !Array.isArray(jsonData.records)) {
      return { success: false, error: { code: "INVALID_JSON", message: "缺少 fields 或 records 数组" } };
    }

    // Check duplicate name
    const existing = await db.dataTable.findUnique({
      where: { name: jsonData.table.name },
    });
    if (existing) {
      return { success: false, error: { code: "DUPLICATE_NAME", message: `数据表名称 "${jsonData.table.name}" 已存在` } };
    }

    // Filter out relation fields (cross-site relationTo IDs are meaningless)
    const RELATION_TYPES = new Set(["RELATION", "RELATION_SUBTABLE"]);
    const nonRelationFields = jsonData.fields.filter((f) => !RELATION_TYPES.has(f.type));
    const skippedRelationFields = jsonData.fields
      .filter((f) => RELATION_TYPES.has(f.type))
      .map((f) => f.label || f.key);
    const nonRelationFieldKeys = new Set(nonRelationFields.map((f) => f.key));

    const result = await db.$transaction(async (tx) => {
      // 1. Create table
      const table = await tx.dataTable.create({
        data: {
          name: jsonData.table.name,
          description: jsonData.table.description ?? null,
          icon: jsonData.table.icon ?? null,
          businessKeys: jsonData.table.businessKeys ?? [],
          createdById: userId,
        },
      });

      // 2. Create fields
      for (const field of nonRelationFields) {
        await tx.dataField.create({
          data: {
            tableId: table.id,
            key: field.key,
            label: field.label,
            type: field.type as FieldType,
            required: field.required ?? false,
            options: field.options as Prisma.InputJsonValue ?? null,
            defaultValue: field.defaultValue ?? null,
            sortOrder: field.sortOrder ?? 0,
          },
        });
      }

      // 3. Create records (strip relation field values)
      if (jsonData.records.length > 0) {
        const recordsData = jsonData.records.map((record) => {
          const filtered: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(record)) {
            if (nonRelationFieldKeys.has(k)) {
              filtered[k] = v;
            }
          }
          return filtered;
        });

        await tx.dataRecord.createMany({
          data: recordsData.map((record) => ({
            tableId: table.id,
            data: record as Prisma.InputJsonValue,
            createdById: userId,
          })),
        });
      }

      return {
        tableId: table.id,
        tableName: table.name,
        fieldCount: nonRelationFields.length,
        recordCount: jsonData.records.length,
      };
    });

    return {
      success: true,
      data: {
        ...result,
        skippedRelationFields,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "导入数据表失败";
    return { success: false, error: { code: "IMPORT_TABLE_ERROR", message } };
  }
}

// ── Import Bundle (multi-table with relations) ──

function buildBusinessKeyString(record: Record<string, unknown>, businessKeys: string[]): string {
  return businessKeys.map((k) => String(record[k] ?? "")).join("|");
}

async function findUniqueTableName(baseName: string): Promise<string> {
  let name = baseName;
  let suffix = 1;
  while (await db.dataTable.findUnique({ where: { name } })) {
    name = `${baseName}_imported${suffix > 1 ? `_${suffix}` : ""}`;
    suffix++;
  }
  return name;
}

export async function importBundle(
  userId: string,
  bundle: ExportBundle
): Promise<ServiceResult<BundleImportResult>> {
  try {
    // Validate
    if (bundle.version !== "2.0" || !bundle.tables || typeof bundle.tables !== "object") {
      return { success: false, error: { code: "INVALID_BUNDLE", message: "无效的 bundle 格式" } };
    }

    const tableNames = Object.keys(bundle.tables);
    if (tableNames.length === 0) {
      return { success: false, error: { code: "INVALID_BUNDLE", message: "bundle 中没有表数据" } };
    }

    const result: BundleImportResult = {
      tables: [],
      relationLinksCreated: 0,
      errors: [],
    };

    // Resolve unique table names
    const tableNameMap = new Map<string, string>(); // bundle name -> actual DB name
    for (const name of tableNames) {
      const actualName = await findUniqueTableName(name);
      tableNameMap.set(name, actualName);
    }

    // Phase 1: Create all tables + non-relation fields + records (stripped of relation values)
    const tableIdMap = new Map<string, string>(); // bundle name -> new table ID
    const recordIdMap = new Map<string, Map<string, string>>(); // bundle tableName -> bkString -> new record ID

    await db.$transaction(async (tx) => {
      // 1a. Create table shells
      for (const [bundleName, tableData] of Object.entries(bundle.tables)) {
        const actualName = tableNameMap.get(bundleName)!;
        const table = await tx.dataTable.create({
          data: {
            name: actualName,
            description: tableData.description ?? null,
            icon: tableData.icon ?? null,
            businessKeys: tableData.businessKeys ?? [],
            createdById: userId,
          },
        });
        tableIdMap.set(bundleName, table.id);
      }

      // 1b. Create non-relation fields
      for (const [bundleName, tableData] of Object.entries(bundle.tables)) {
        const tableId = tableIdMap.get(bundleName)!;
        const nonRelFields = tableData.fields.filter(
          (f) => f.type !== "RELATION" && f.type !== "RELATION_SUBTABLE"
        );
        for (const field of nonRelFields) {
          await tx.dataField.create({
            data: {
              tableId,
              key: field.key,
              label: field.label,
              type: field.type as FieldType,
              required: field.required ?? false,
              options: field.options as Prisma.InputJsonValue ?? null,
              defaultValue: field.defaultValue ?? null,
              sortOrder: field.sortOrder ?? 0,
            },
          });
        }
      }

      // 1c. Create records (strip relation field values)
      for (const [bundleName, tableData] of Object.entries(bundle.tables)) {
        const tableId = tableIdMap.get(bundleName)!;
        const relFieldKeys = new Set(
          tableData.fields
            .filter((f) => f.type === "RELATION" || f.type === "RELATION_SUBTABLE")
            .map((f) => f.key)
        );
        const bks = tableData.businessKeys ?? [];
        const bkLookup = new Map<string, string>();

        if (tableData.records.length > 0) {
          const recordsData = tableData.records.map((record) => {
            const filtered: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(record)) {
              if (!relFieldKeys.has(k)) {
                filtered[k] = v;
              }
            }
            return filtered;
          });

          for (const data of recordsData) {
            const created = await tx.dataRecord.create({
              data: {
                tableId,
                data: data as Prisma.InputJsonValue,
                createdById: userId,
              },
            });
            const bkStr = buildBusinessKeyString(data, bks);
            if (bkStr) {
              bkLookup.set(bkStr, created.id);
            }
          }
        }

        recordIdMap.set(bundleName, bkLookup);

        result.tables.push({
          tableName: tableNameMap.get(bundleName)!,
          tableId,
          fieldCount: tableData.fields.filter(
            (f) => f.type !== "RELATION" && f.type !== "RELATION_SUBTABLE"
          ).length,
          recordCount: tableData.records.length,
        });
      }
    });

    // Phase 2: Create relation fields using updateFields (handles inverse fields)
    for (const [bundleName, tableData] of Object.entries(bundle.tables)) {
      const tableId = tableIdMap.get(bundleName)!;
      const relFields = tableData.fields.filter(
        (f) => f.type === "RELATION" || f.type === "RELATION_SUBTABLE"
      );

      if (relFields.length === 0) continue;

      // Get existing non-relation fields
      const existingFields = await db.dataField.findMany({
        where: { tableId },
        orderBy: { sortOrder: "asc" },
      });

      // Build full field list including relation fields
      const allFields: DataFieldInput[] = existingFields.map((f) => ({
        id: f.id,
        key: f.key,
        label: f.label,
        type: f.type as FieldType,
        required: f.required,
        options: f.options as DataFieldInput["options"],
        defaultValue: f.defaultValue ?? undefined,
        sortOrder: f.sortOrder,
      }));

      // Add relation fields with resolved table IDs
      for (const relField of relFields) {
        const targetBundleName = relField.relationTo;
        const targetTableId = targetBundleName ? tableIdMap.get(targetBundleName) : undefined;

        if (!targetTableId) {
          result.errors.push({
            tableName: bundleName,
            message: `关系字段 ${relField.key} 的目标表 ${targetBundleName ?? "null"} 未在 bundle 中找到`,
          });
          continue;
        }

        allFields.push({
          key: relField.key,
          label: relField.label,
          type: relField.type as FieldType,
          required: relField.required,
          relationTo: targetTableId,
          displayField: relField.displayField ?? undefined,
          relationCardinality: relField.relationCardinality as DataFieldInput["relationCardinality"],
          inverseRelationCardinality: relField.inverseRelationCardinality as DataFieldInput["inverseRelationCardinality"],
          relationSchema: relField.relationSchema as DataFieldInput["relationSchema"],
          sortOrder: relField.sortOrder,
        });
      }

      const updateResult = await updateFields(tableId, allFields, tableData.businessKeys);
      if (!updateResult.success) {
        result.errors.push({
          tableName: bundleName,
          message: `创建关系字段失败: ${updateResult.error.message}`,
        });
      }
    }

    // Phase 3: Link records via relation values
    for (const [bundleName, tableData] of Object.entries(bundle.tables)) {
      const tableId = tableIdMap.get(bundleName)!;
      const sourceBkMap = recordIdMap.get(bundleName);
      if (!sourceBkMap) continue;

      const relFields = tableData.fields.filter(
        (f) => f.type === "RELATION_SUBTABLE" && f.relationTo
      );

      for (const relField of relFields) {
        const targetBkMap = recordIdMap.get(relField.relationTo!);
        if (!targetBkMap) continue;

        // Get the field ID for this relation field
        const field = await db.dataField.findFirst({
          where: { tableId, key: relField.key },
        });
        if (!field) continue;

        for (const record of tableData.records) {
          const relValue = record[relField.key];
          if (!relValue || !Array.isArray(relValue)) continue;

          // Find source record ID
          const sourceBkStr = buildBusinessKeyString(record, tableData.businessKeys ?? []);
          const sourceRecordId = sourceBkMap.get(sourceBkStr);
          if (!sourceRecordId) continue;

          // Resolve target record IDs from _ref business keys
          const resolvedItems: RelationSubtableValueItem[] = [];
          for (const item of relValue as Array<Record<string, unknown>>) {
            const ref = item._ref as Record<string, unknown> | undefined;
            if (!ref) continue;

            const targetBkStr = Object.values(ref).map((v) => String(v ?? "")).join("|");
            const targetRecordId = targetBkMap.get(targetBkStr);
            if (!targetRecordId) continue;

            resolvedItems.push({
              targetRecordId,
              displayValue: item.displayValue as string | undefined,
              attributes: (item.attributes as Record<string, unknown>) ?? {},
              sortOrder: (item.sortOrder as number) ?? 0,
            });
          }

          if (resolvedItems.length > 0) {
            await db.$transaction(async (tx) => {
              await syncRelationSubtableValues({
                tx,
                sourceRecordId,
                tableId,
                relationPayload: { [relField.key]: resolvedItems },
              });
            });
            result.relationLinksCreated += resolvedItems.length;
          }
        }
      }

      // Also handle RELATION (single) fields
      const singleRelFields = tableData.fields.filter(
        (f) => f.type === "RELATION" && f.relationTo
      );

      for (const relField of singleRelFields) {
        const targetBkMap = recordIdMap.get(relField.relationTo!);
        if (!targetBkMap) continue;

        for (const record of tableData.records) {
          const relValue = record[relField.key];
          if (!relValue || typeof relValue !== "object") continue;

          const ref = (relValue as Record<string, unknown>)._ref as Record<string, unknown> | undefined;
          if (!ref) continue;

          const targetBkStr = Object.values(ref).map((v) => String(v ?? "")).join("|");
          const targetRecordId = targetBkMap.get(targetBkStr);
          if (!targetRecordId) continue;

          const sourceBkStr = buildBusinessKeyString(record, tableData.businessKeys ?? []);
          const sourceRecordId = sourceBkMap.get(sourceBkStr);
          if (!sourceRecordId) continue;

          await db.$executeRaw`
            UPDATE "DataRecord"
            SET data = jsonb_set(data, ${Prisma.sql`ARRAY[${relField.key}]::text[]`}, ${Prisma.sql`to_jsonb(${targetRecordId}::text)`})
            WHERE id = ${sourceRecordId}
          `;
          result.relationLinksCreated++;
        }
      }
    }

    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "导入 bundle 失败";
    return { success: false, error: { code: "IMPORT_BUNDLE_ERROR", message } };
  }
}