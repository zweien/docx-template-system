export const DOCUMENT_COLLECTION_RESERVED_VARIABLE_KEYS = new Set([
  "序号",
  "提交时间",
  "任务标题",
  "姓名",
  "邮箱",
  "原始文件名",
  "版本号",
]);

export interface DocumentCollectionFileNameContext {
  sequence: number;
  submittedAt: Date;
  taskTitle: string;
  name: string;
  email: string;
  originalFileName: string;
  version: number;
  taskVariables?: Record<string, string | number | null | undefined>;
}

function formatTimestamp(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

function sanitizeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
}

function replaceToken(input: string, token: string, value: string): string {
  return input.split(`{${token}}`).join(value);
}

export function buildDocumentCollectionFileName(
  pattern: string,
  context: DocumentCollectionFileNameContext
): string {
  const normalizedPattern = (pattern || "").trim();
  const template = normalizedPattern ? normalizedPattern.replace(/\.docx$/i, "") : "document";

  const replacementMap: Record<string, string> = {
    序号: String(context.sequence),
    提交时间: formatTimestamp(context.submittedAt),
    任务标题: context.taskTitle,
    姓名: context.name,
    邮箱: context.email,
    原始文件名: stripExtension(context.originalFileName),
    版本号: String(context.version),
  };

  let fileName = template;
  for (const [token, value] of Object.entries(replacementMap)) {
    fileName = replaceToken(fileName, token, value);
  }

  for (const [token, value] of Object.entries(context.taskVariables ?? {})) {
    fileName = replaceToken(fileName, token, String(value ?? ""));
  }

  fileName = sanitizeFileName(fileName);
  fileName = fileName.trim() || "document";

  return `${fileName}.docx`;
}
