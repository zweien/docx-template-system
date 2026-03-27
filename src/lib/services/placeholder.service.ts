import { db } from "@/lib/db";
import { PlaceholderType } from "@/generated/prisma/enums";
import { extractPlaceholders } from "@/lib/docx-parser";
import { changeStatus } from "@/lib/services/template.service";
import type { PlaceholderItem, PlaceholderWithSource } from "@/types/placeholder";
import * as XLSX from "xlsx";

// ── Unified return type ──

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

// ── Helper ──

function mapPlaceholderItem(row: {
  id: string;
  key: string;
  label: string;
  inputType: string;
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  sourceTableId: string | null;
  sourceField: string | null;
  enablePicker: boolean;
}): PlaceholderItem {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    inputType: row.inputType,
    required: row.required,
    defaultValue: row.defaultValue,
    sortOrder: row.sortOrder,
    sourceTableId: row.sourceTableId,
    sourceField: row.sourceField,
    enablePicker: row.enablePicker,
  };
}

// ── Public API ──

export interface ExcelPlaceholderRow {
  key: string;
  label: string;
  inputType?: string;
  required?: string;
  defaultValue?: string | null;
}

export function importPlaceholdersFromExcel(
  buffer: ArrayBuffer
): { success: true; data: ExcelPlaceholderRow[] } | { success: false; error: { code: string; message: string } } {
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { success: false, error: { code: "PARSE_FAILED", message: "Excel 文件中没有工作表" } };
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    if (rows.length === 0) {
      return { success: false, error: { code: "PARSE_FAILED", message: "Excel 文件中没有数据行" } };
    }

    const validInputTypes = new Set(["TEXT", "TEXTAREA"]);
    const errors: string[] = [];

    const result: ExcelPlaceholderRow[] = rows.map((row, index) => {
      const key = String(row["key"] ?? "").trim();
      const label = String(row["label"] ?? "").trim();

      if (!key) errors.push(`第 ${index + 2} 行: key 不能为空`);
      if (!label) errors.push(`第 ${index + 2} 行: label 不能为空`);

      let inputType = String(row["inputType"] ?? "TEXT").trim().toUpperCase();
      if (!validInputTypes.has(inputType)) inputType = "TEXT";

      const required = String(row["required"] ?? "").trim();
      const defaultValue = String(row["defaultValue"] ?? "").trim() || null;

      return { key, label, inputType, required, defaultValue };
    });

    if (errors.length > 0) {
      return { success: false, error: { code: "VALIDATION_ERROR", message: errors.join("; ") } };
    }

    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析 Excel 文件失败";
    return { success: false, error: { code: "PARSE_FAILED", message } };
  }
}

export async function parsePlaceholders(
  templateId: string
): Promise<ServiceResult<PlaceholderItem[]>> {
  try {
    const template = await db.template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "模板不存在" },
      };
    }

    const keys = await extractPlaceholders(template.filePath);

    // Replace all existing placeholders with freshly parsed ones
    await db.placeholder.deleteMany({ where: { templateId } });

    await db.placeholder.createMany({
      data: keys.map((key, index) => ({
        key,
        label: key, // default label = key; user will configure later
        inputType: PlaceholderType.TEXT,
        required: false,
        sortOrder: index,
        templateId,
      })),
    });

    // Retrieve the created placeholders to return full objects
    const placeholders = await db.placeholder.findMany({
      where: { templateId },
      orderBy: { sortOrder: "asc" },
    });

    return { success: true, data: placeholders.map(mapPlaceholderItem) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析占位符失败";
    return { success: false, error: { code: "PARSE_FAILED", message } };
  }
}

export interface UpdatePlaceholderInput {
  key: string;
  label: string;
  inputType: string;
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  enablePicker?: boolean;
  sourceTableId?: string | null;
  sourceField?: string | null;
}

export async function updatePlaceholders(
  templateId: string,
  items: UpdatePlaceholderInput[]
): Promise<ServiceResult<PlaceholderItem[]>> {
  try {
    // Validate all labels are non-empty
    const errors: string[] = [];
    for (const item of items) {
      if (!item.label.trim()) {
        errors.push(`占位符 "${item.key}" 的标签不能为空`);
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: { code: "VALIDATION_ERROR", message: errors.join("; ") },
      };
    }

    // Delete all existing placeholders
    await db.placeholder.deleteMany({ where: { templateId } });

    // Create new placeholders from the items array
    await db.placeholder.createMany({
      data: items.map((item) => ({
        key: item.key,
        label: item.label.trim(),
        inputType: item.inputType as "TEXT" | "TEXTAREA",
        required: item.required,
        defaultValue: item.defaultValue,
        sortOrder: item.sortOrder,
        templateId,
        enablePicker: item.enablePicker ?? false,
        sourceTableId: item.sourceTableId ?? null,
        sourceField: item.sourceField ?? null,
      })),
    });

    // If valid, also change template status to PUBLISHED
    await changeStatus(templateId, "PUBLISHED");

    // Retrieve the created placeholders
    const placeholders = await db.placeholder.findMany({
      where: { templateId },
      orderBy: { sortOrder: "asc" },
    });

    return { success: true, data: placeholders.map(mapPlaceholderItem) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新占位符失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}

export async function validatePlaceholders(
  templateId: string
): Promise<ServiceResult<{ valid: boolean; errors: string[] }>> {
  try {
    const placeholders = await db.placeholder.findMany({
      where: { templateId },
      orderBy: { sortOrder: "asc" },
    });

    const errors: string[] = [];

    for (const p of placeholders) {
      if (!p.label.trim()) {
        errors.push(`占位符 "${p.key}" 的标签不能为空`);
      }
    }

    return {
      success: true,
      data: { valid: errors.length === 0, errors },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "验证占位符失败";
    return { success: false, error: { code: "VALIDATE_FAILED", message } };
  }
}

export async function updatePlaceholderSource(
  id: string,
  data: { sourceTableId?: string | null; sourceField?: string | null; enablePicker?: boolean }
): Promise<ServiceResult<PlaceholderWithSource>> {
  try {
    const placeholder = await db.placeholder.update({
      where: { id },
      data: {
        sourceTableId: data.sourceTableId,
        sourceField: data.sourceField,
        enablePicker: data.enablePicker,
      },
    });
    return { success: true, data: placeholder as PlaceholderWithSource };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新占位符数据源失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}

export async function getPlaceholderById(id: string): Promise<PlaceholderWithSource | null> {
  return db.placeholder.findUnique({
    where: { id },
  }) as Promise<PlaceholderWithSource | null>;
}
