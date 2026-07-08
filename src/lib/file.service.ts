import { writeFile, mkdir, copyFile, unlink, rm, readdir, stat } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import archiver from "archiver";
import { createWriteStream } from "fs";
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

// ── DOWNLOAD 型模板：sources/ 存原始文件，bundle.zip 为打包结果 ──

function getTemplateSourcesDir(templateId: string): string {
  return join(process.cwd(), UPLOAD_DIR, "templates", templateId, "sources");
}

function getTemplateBundlePath(templateId: string): string {
  return join(process.cwd(), UPLOAD_DIR, "templates", templateId, "bundle.zip");
}

/**
 * 保存 DOWNLOAD 型模板的一个原始文件到 sources/ 目录。
 * 同名文件自动加序号后缀防覆盖。
 */
export async function saveTemplateSourceFile(
  templateId: string,
  buffer: Buffer,
  originalName: string
): Promise<FilePathMeta> {
  const dir = getTemplateSourcesDir(templateId);
  await ensureDirectory(dir);

  // 防覆盖：同名时加 序号
  const baseName = originalName;
  let storedName = baseName;
  let counter = 1;
  while (existsSync(join(dir, storedName))) {
    const dot = baseName.lastIndexOf(".");
    storedName =
      dot > 0
        ? `${baseName.slice(0, dot)} (${counter})${baseName.slice(dot)}`
        : `${baseName} (${counter})`;
    counter++;
  }

  const filePath = join(dir, storedName);
  await writeFile(filePath, buffer);

  return {
    fileName: storedName,
    filePath,
    urlPath: `${getPublicUrlBase()}/templates/${templateId}/sources/${storedName}`.replace(
      /\/+/g,
      "/"
    ),
  };
}

/**
 * 列出 DOWNLOAD 型模板 sources/ 目录下的所有文件（文件名 + 大小）。
 */
export async function listTemplateSourceFiles(
  templateId: string
): Promise<{ fileName: string; fileSize: number }[]> {
  const dir = getTemplateSourcesDir(templateId);
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  const result: { fileName: string; fileSize: number }[] = [];
  for (const name of entries) {
    const s = await stat(join(dir, name));
    if (s.isFile()) {
      result.push({ fileName: name, fileSize: s.size });
    }
  }
  return result;
}

/**
 * 解析并校验 DOWNLOAD 型模板单个源文件路径，防路径穿越。
 */
export function getTemplateSourceFilePath(
  templateId: string,
  fileName: string
): string | null {
  const dir = getTemplateSourcesDir(templateId);
  const target = join(dir, fileName);
  // 校验解析后仍在 sources/ 目录内
  if (!target.startsWith(dir + "/") && target !== dir) return null;
  if (!existsSync(target)) return null;
  return target;
}

/**
 * 删除 DOWNLOAD 型模板 sources/ 下的一个文件。
 */
export async function deleteTemplateSourceFile(
  templateId: string,
  fileName: string
): Promise<boolean> {
  const target = getTemplateSourceFilePath(templateId, fileName);
  if (!target) return false;
  await unlink(target);
  return true;
}

/**
 * 把 DOWNLOAD 型模板 sources/ 下所有文件打包成 bundle.zip。
 * 返回 bundle 的 FilePathMeta。sources/ 为空时返回 null。
 */
export async function packTemplateBundle(
  templateId: string
): Promise<FilePathMeta | null> {
  const sourcesDir = getTemplateSourcesDir(templateId);
  if (!existsSync(sourcesDir)) return null;
  const files = await readdir(sourcesDir);
  if (files.length === 0) return null;

  const bundlePath = getTemplateBundlePath(templateId);
  await ensureDirectory(join(process.cwd(), UPLOAD_DIR, "templates", templateId));

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(bundlePath);
    const archive = archiver("zip", { zlib: { level: 6 } });
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    for (const name of files) {
      archive.file(join(sourcesDir, name), { name });
    }
    archive.finalize();
  });

  return {
    fileName: "bundle.zip",
    filePath: bundlePath,
    urlPath: `${getPublicUrlBase()}/templates/${templateId}/bundle.zip`.replace(
      /\/+/g,
      "/"
    ),
  };
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
