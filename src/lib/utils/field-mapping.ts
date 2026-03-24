// src/lib/utils/field-mapping.ts

import type { FieldMapping } from "@/types/batch-generation";

interface Placeholder {
  key: string;
  label: string;
}

interface DataField {
  key: string;
  label: string;
}

/**
 * 自动匹配占位符到数据字段
 * 匹配优先级: 精确匹配 > 驼峰转下划线 > 模糊匹配
 */
export function autoMatchFields(
  placeholders: Placeholder[],
  dataFields: DataField[]
): FieldMapping {
  const mapping: FieldMapping = {};

  for (const placeholder of placeholders) {
    // 1. 精确匹配（忽略大小写）
    const exactMatch = dataFields.find(
      (f) => f.key.toLowerCase() === placeholder.key.toLowerCase()
    );

    if (exactMatch) {
      mapping[placeholder.key] = exactMatch.key;
      continue;
    }

    // 2. 驼峰转下划线匹配
    const snakeCase = placeholder.key
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase();
    const snakeMatch = dataFields.find((f) => f.key === snakeCase);

    if (snakeMatch) {
      mapping[placeholder.key] = snakeMatch.key;
      continue;
    }

    // 3. 模糊匹配（包含关系）
    const fuzzyMatch = dataFields.find(
      (f) =>
        f.key.toLowerCase().includes(placeholder.key.toLowerCase()) ||
        placeholder.key.toLowerCase().includes(f.key.toLowerCase())
    );

    if (fuzzyMatch) {
      mapping[placeholder.key] = fuzzyMatch.key;
      continue;
    }

    // 4. 未匹配
    mapping[placeholder.key] = null;
  }

  return mapping;
}

/**
 * 验证字段映射是否完整（所有必填占位符都有映射）
 */
export function validateFieldMapping(
  mapping: FieldMapping,
  requiredPlaceholders: string[]
): { valid: boolean; missingFields: string[] } {
  const missingFields = requiredPlaceholders.filter(
    (key) => !mapping[key] || mapping[key] === null
  );

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * 根据映射关系构建表单数据
 */
export function buildFormData(
  mapping: FieldMapping,
  recordData: Record<string, unknown>
): Record<string, string> {
  const formData: Record<string, string> = {};

  for (const [placeholderKey, dataFieldKey] of Object.entries(mapping)) {
    if (dataFieldKey && recordData[dataFieldKey] !== undefined) {
      formData[placeholderKey] = String(recordData[dataFieldKey] ?? "");
    } else {
      formData[placeholderKey] = "";
    }
  }

  return formData;
}
