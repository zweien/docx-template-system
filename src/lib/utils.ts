import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 从 Excel 列名自动生成合法的字段 key
 * - 非 [a-z0-9] 替换为 _，压缩连续下划线
 * - 首字符非小写字母则加 field_ 前缀
 * - 与已有 key 重复则追加数字后缀
 */
export function generateFieldKey(columnLabel: string, existingKeys: string[]): string {
  // 替换非小写字母数字为下划线，压缩连续下划线
  let key = columnLabel
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  // 首字符非小写字母则加前缀
  if (!/^[a-z]/.test(key)) {
    key = "field_" + key;
  }

  // 去重：与已有 key 重复则追加数字后缀
  const keySet = new Set(existingKeys);
  if (keySet.has(key)) {
    let suffix = 2;
    while (keySet.has(`${key}_${suffix}`)) {
      suffix++;
    }
    key = `${key}_${suffix}`;
  }

  return key;
}
