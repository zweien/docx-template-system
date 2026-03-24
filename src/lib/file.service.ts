import { writeFile, mkdir, copyFile, unlink } from "fs/promises";
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
  documentId: string
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
