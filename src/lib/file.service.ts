import { writeFile, mkdir, copyFile, unlink, rm } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import {
  COLLECTION_UPLOAD_DIR,
  UPLOAD_DIR,
} from "@/lib/constants/upload";

export interface FilePathMeta {
  fileName: string; // stored filename: {id}.docx
  filePath: string; // absolute path: {cwd}/public/uploads/templates/{id}.docx
  urlPath: string; // web-accessible path: /uploads/templates/{id}.docx
}

function getPublicUrlBase(): string {
  return UPLOAD_DIR.startsWith("public/") ? UPLOAD_DIR.slice("public".length) : `/${UPLOAD_DIR}`;
}

async function ensureDirectory(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) await mkdir(dirPath, { recursive: true });
}

async function saveFileToDirectory(
  buffer: Buffer,
  dirPath: string,
  relativePath: string,
  fileName: string,
  options?: {
    extension?: string;
  }
): Promise<FilePathMeta> {
  await ensureDirectory(dirPath);

  const ext = options?.extension || "docx";
  const storedFileName = fileName.endsWith(`.${ext}`) ? fileName : `${fileName}.${ext}`;
  const filePath = join(dirPath, storedFileName);
  await writeFile(filePath, buffer);

  return {
    fileName: storedFileName,
    filePath,
    urlPath: `${getPublicUrlBase()}/${relativePath}/${storedFileName}`.replace(/\/+/g, "/"),
  };
}

export async function saveUploadedFile(
  buffer: Buffer,
  originalName: string,
  dir: "templates" | "documents",
  id: string
): Promise<FilePathMeta> {
  const targetDir = join(process.cwd(), UPLOAD_DIR, dir);
  const ext = originalName.split(".").pop() || "docx";
  return saveFileToDirectory(buffer, targetDir, dir, id, { extension: ext });
}

export async function copyTemplateToDocument(
  templateFilePath: string,
  newFileName: string,
  _documentId: string
): Promise<FilePathMeta> {
  const targetDir = join(process.cwd(), UPLOAD_DIR, "documents");
  if (!existsSync(targetDir)) await mkdir(targetDir, { recursive: true });

  const filePath = join(targetDir, newFileName);
  await copyFile(templateFilePath, filePath);

  return {
    fileName: newFileName,
    filePath,
    urlPath: `${getPublicUrlBase()}/documents/${newFileName}`.replace(/\/+/g, "/"),
  };
}

export async function deleteFile(filePath: string): Promise<void> {
  if (existsSync(filePath)) await unlink(filePath);
}

export async function saveTemplateDraft(
  templateId: string,
  buffer: Buffer,
  originalName: string
): Promise<FilePathMeta> {
  const dir = join(process.cwd(), UPLOAD_DIR, "templates", templateId);
  void originalName;
  return saveFileToDirectory(buffer, dir, `templates/${templateId}`, "draft", {
    extension: "docx",
  });
}

export async function copyToVersion(
  templateId: string,
  version: number
): Promise<FilePathMeta> {
  const dir = join(process.cwd(), UPLOAD_DIR, "templates", templateId);
  const draftPath = join(dir, "draft.docx");
  const fileName = `v${version}.docx`;
  const versionPath = join(dir, fileName);

  if (!existsSync(draftPath)) {
    throw new Error(`编辑态文件不存在: ${draftPath}`);
  }

  await copyFile(draftPath, versionPath);

  return {
    fileName,
    filePath: versionPath,
    urlPath: `${getPublicUrlBase()}/templates/${templateId}/${fileName}`.replace(/\/+/g, "/"),
  };
}

export async function deleteTemplateDir(templateId: string): Promise<void> {
  const dir = join(process.cwd(), UPLOAD_DIR, "templates", templateId);
  if (existsSync(dir)) await rm(dir, { recursive: true, force: true });
}

export async function saveCollectionTaskAttachment(
  buffer: Buffer,
  originalName: string,
  taskId: string,
  attachmentId: string
): Promise<FilePathMeta> {
  const dir = join(process.cwd(), COLLECTION_UPLOAD_DIR, "collections", "tasks", taskId);
  const ext = originalName.split(".").pop() || "docx";
  return saveFileToDirectory(buffer, dir, `collections/tasks/${taskId}`, attachmentId, {
    extension: ext,
  });
}

export async function saveCollectionSubmissionFile(
  buffer: Buffer,
  originalName: string,
  versionId: string
): Promise<FilePathMeta> {
  const dir = join(process.cwd(), COLLECTION_UPLOAD_DIR, "collections", "submissions");
  const ext = originalName.split(".").pop() || "docx";
  return saveFileToDirectory(buffer, dir, "collections/submissions", versionId, {
    extension: ext,
  });
}

export function resolveStoredFilePath(storagePath: string): string {
  const publicUrlBase = getPublicUrlBase();

  if (storagePath.startsWith(`${publicUrlBase}/`)) {
    const relativePath = storagePath.slice(publicUrlBase.length + 1);
    if (relativePath.startsWith("collections/")) {
      const privatePath = join(process.cwd(), COLLECTION_UPLOAD_DIR, relativePath);
      if (existsSync(privatePath)) {
        return privatePath;
      }
    }
    return join(process.cwd(), UPLOAD_DIR, relativePath);
  }

  return storagePath;
}

export async function saveReportTemplateFile(
  buffer: Buffer,
  originalName: string,
  id: string
): Promise<FilePathMeta> {
  const targetDir = join(process.cwd(), UPLOAD_DIR, "report-templates");
  return saveFileToDirectory(buffer, targetDir, "report-templates", id, {
    extension: "docx",
  });
}

export async function saveReportImage(
  buffer: Buffer,
  originalName: string,
  id: string
): Promise<FilePathMeta> {
  const targetDir = join(process.cwd(), UPLOAD_DIR, "reports", "images");
  const ext = originalName.split(".").pop() || "png";
  return saveFileToDirectory(buffer, targetDir, "reports/images", id, {
    extension: ext,
  });
}

export async function deleteReportTemplateFile(filePath: string): Promise<void> {
  await deleteFile(filePath);
}
