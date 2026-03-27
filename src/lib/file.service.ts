import { writeFile, mkdir, copyFile, unlink, rm } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { UPLOAD_DIR } from "@/lib/constants/upload";

export interface FilePathMeta {
  fileName: string; // stored filename: {id}.docx
  filePath: string; // absolute path: {cwd}/public/uploads/templates/{id}.docx
  urlPath: string; // web-accessible path: /uploads/templates/{id}.docx
}

export async function saveUploadedFile(
  buffer: Buffer,
  originalName: string,
  dir: "templates" | "documents",
  id: string
): Promise<FilePathMeta> {
  const targetDir = join(process.cwd(), UPLOAD_DIR, dir);
  if (!existsSync(targetDir)) await mkdir(targetDir, { recursive: true });

  const ext = originalName.split(".").pop() || "docx";
  const fileName = `${id}.${ext}`;
  const filePath = join(targetDir, fileName);
  await writeFile(filePath, buffer);

  return {
    fileName,
    filePath,
    urlPath: `/${UPLOAD_DIR}/${dir}/${fileName}`,
  };
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
    urlPath: `/${UPLOAD_DIR}/documents/${newFileName}`,
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
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });

  const fileName = "draft.docx";
  const filePath = join(dir, fileName);
  await writeFile(filePath, buffer);

  return {
    fileName,
    filePath,
    urlPath: `/${UPLOAD_DIR}/templates/${templateId}/${fileName}`,
  };
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
    urlPath: `/${UPLOAD_DIR}/templates/${templateId}/${fileName}`,
  };
}

export async function deleteTemplateDir(templateId: string): Promise<void> {
  const dir = join(process.cwd(), UPLOAD_DIR, "templates", templateId);
  if (existsSync(dir)) await rm(dir, { recursive: true, force: true });
}
