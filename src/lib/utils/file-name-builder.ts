// src/lib/utils/file-name-builder.ts

/**
 * 可用的文件名变量
 */
export const FILE_NAME_VARIABLES = [
  { key: "{date}", description: "当前日期 (YYYY-MM-DD)" },
  { key: "{time}", description: "当前时间 (HHmmss)" },
  { key: "{序号}", description: "批量生成序号 (从1开始)" },
];

/**
 * 获取可用的字段变量列表
 */
export function getFieldVariables(
  dataFields: { key: string; label: string }[]
): { key: string; description: string }[] {
  return dataFields.map((f) => ({
    key: `{${f.key}}`,
    description: f.label,
  }));
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 根据模式构建文件名
 * @param pattern 文件名模式，如 "{project_name}_合同_{date}"
 * @param recordData 数据记录
 * @param index 批量生成时的序号（从1开始）
 */
export function buildFileName(
  pattern: string,
  recordData: Record<string, unknown>,
  index: number = 1
): string {
  // 空模式检查
  if (!pattern || !pattern.trim()) {
    return `document_${index}.docx`;
  }

  const now = new Date();
  const yyyy = now.getFullYear().toString().padStart(4, "0");
  const MM = (now.getMonth() + 1).toString().padStart(2, "0");
  const dd = now.getDate().toString().padStart(2, "0");
  const HH = now.getHours().toString().padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");
  const ss = now.getSeconds().toString().padStart(2, "0");

  let fileName = pattern;

  // 替换内置变量（支持单括号和双括号格式）
  fileName = fileName.replace(/\{\{?date\}\}?/g, `${yyyy}-${MM}-${dd}`);
  fileName = fileName.replace(/\{\{?time\}\}?/g, `${HH}${mm}${ss}`);
  fileName = fileName.replace(/\{\{?序号\}\}?/g, String(index));
  fileName = fileName.replace(/\{\{?_index\}\}?/g, String(index));

  // 替换字段变量（使用转义后的key防止正则注入，支持双括号格式）
  for (const [key, value] of Object.entries(recordData)) {
    // 支持 {key} 和 {{key}} 两种格式
    fileName = fileName.replace(
      new RegExp(`\\{\\{?${escapeRegex(key)}\\}\\}?`, "g"),
      String(value ?? "")
    );
  }

  // 清理文件名中的非法字符
  fileName = fileName.replace(/[<>:"/\\|?*]/g, "_");

  // 限制文件名长度（保留扩展名空间）
  if (fileName.length > 200) {
    fileName = fileName.substring(0, 200);
  }

  return fileName;
}

/**
 * 生成唯一的文件名（如果存在同名文件则添加序号）
 */
export function generateUniqueFileName(
  baseName: string,
  existingNames: Set<string>
): string {
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  const extIndex = baseName.lastIndexOf(".");
  const name = extIndex > 0 ? baseName.substring(0, extIndex) : baseName;
  const ext = extIndex > 0 ? baseName.substring(extIndex) : "";

  let counter = 2;
  while (existingNames.has(`${name} (${counter})${ext}`)) {
    counter++;
  }

  return `${name} (${counter})${ext}`;
}
