import JSZip from "jszip";
import { dirname } from "path";
import { existsSync } from "fs";
import { mkdir, writeFile, readFile } from "fs/promises";
import { UPLOAD_DIR } from "@/lib/constants/upload";
import { resolveStoredFilePath } from "@/lib/file.service";
import type { DataFieldItem } from "@/types/data-table";

// ── Types ──

export interface AttachmentMeta {
  pathMapping: Record<string, string>;
  originalUploadDir: string;
}

export interface ZipRestoreOptions {
  currentUploadDir?: string;
}

// ── Helpers ──

/**
 * Convert an upload directory to its URL base.
 * "public/uploads" -> "/uploads"
 * "/data/files" -> "/data/files"
 */
export function getUrlBase(uploadDir: string): string {
  if (uploadDir.startsWith("public/")) {
    return uploadDir.slice("public".length);
  }
  return uploadDir.startsWith("/") ? uploadDir : `/${uploadDir}`;
}

/**
 * Scan records for FILE type field values and collect unique file paths.
 */
export function scanFileAttachments(
  records: Array<{ data: Record<string, unknown> }>,
  fields: DataFieldItem[]
): Set<string> {
  const fileFieldKeys = new Set(
    fields.filter((f) => f.type === "FILE").map((f) => f.key)
  );

  const paths = new Set<string>();

  for (const record of records) {
    for (const key of fileFieldKeys) {
      const value = record.data[key];
      if (typeof value === "string" && value.length > 0) {
        paths.add(value);
      }
    }
  }

  return paths;
}

/**
 * Rewrite a file path from one upload directory base to another.
 */
export function rewriteFilePath(
  path: string,
  originalUploadDir: string,
  currentUploadDir?: string
): string {
  const originalBase = getUrlBase(originalUploadDir);
  const currentBase = getUrlBase(currentUploadDir ?? UPLOAD_DIR);

  if (path.startsWith(originalBase + "/")) {
    return currentBase + path.slice(originalBase.length);
  }

  // Fallback: if path starts with "/uploads/" and currentBase is different
  if (path.startsWith("/uploads/") && currentBase !== "/uploads") {
    return currentBase + path.slice("/uploads".length);
  }

  return path;
}

/**
 * Mutate records to rewrite FILE field paths for the current environment.
 */
export function rewriteRecordFilePaths(
  records: Array<{ data: Record<string, unknown> }>,
  fields: DataFieldItem[],
  originalUploadDir: string
): void {
  const fileFieldKeys = new Set(
    fields.filter((f) => f.type === "FILE").map((f) => f.key)
  );

  for (const record of records) {
    for (const key of fileFieldKeys) {
      const value = record.data[key];
      if (typeof value === "string" && value.length > 0) {
        record.data[key] = rewriteFilePath(value, originalUploadDir);
      }
    }
  }
}

/**
 * Create a ZIP archive containing data.json and an attachments/ directory.
 */
export async function createZipWithAttachments(
  data: unknown,
  allRecords: Array<{ data: Record<string, unknown> }>,
  allFields: DataFieldItem[]
): Promise<Buffer> {
  const zip = new JSZip();

  // Collect file attachments
  const filePaths = scanFileAttachments(allRecords, allFields);
  const originalUploadDir = UPLOAD_DIR;
  const pathMapping: Record<string, string> = {};

  for (const filePath of filePaths) {
    const absolutePath = resolveStoredFilePath(filePath);

    if (!existsSync(absolutePath)) {
      continue;
    }

    // Store as attachments{originalPath} e.g. attachments/uploads/files/abc.pdf
    const zipPath = `attachments${filePath}`;
    const fileBuffer = await readFile(absolutePath);
    zip.file(zipPath, fileBuffer);
    pathMapping[filePath] = zipPath;
  }

  // Inject attachment metadata into data.json
  const dataWithMeta = {
    ...(data as Record<string, unknown>),
    attachments: {
      pathMapping,
      originalUploadDir,
    } satisfies AttachmentMeta,
  };
  zip.file("data.json", JSON.stringify(dataWithMeta, null, 2));

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return Buffer.from(buffer);
}

/**
 * Extract a ZIP archive, restore attachments to the current environment,
 * and return the parsed data with attachment metadata.
 */
export async function extractZipAndRestoreAttachments(
  zipBuffer: Buffer,
  options?: ZipRestoreOptions
): Promise<{
  data: unknown;
  meta: AttachmentMeta;
}> {
  const zip = await JSZip.loadAsync(zipBuffer);

  // Extract data.json (contains embedded attachment metadata)
  const dataFile = zip.file("data.json");
  if (!dataFile) {
    throw new Error("ZIP archive missing data.json");
  }
  const data = JSON.parse(await dataFile.async("string"));

  const meta = (data.attachments ?? {
    pathMapping: {},
    originalUploadDir: "public/uploads",
  }) as AttachmentMeta;

  // Remove the data.attachments from the returned data so consumers don't see it
  if (data.attachments) {
    delete (data as Record<string, unknown>).attachments;
  }

  const currentUploadDir = options?.currentUploadDir ?? UPLOAD_DIR;

  // Restore each attachment file
  for (const [originalPath, zipPath] of Object.entries(meta.pathMapping)) {
    const fileInZip = zip.file(zipPath);
    if (!fileInZip) {
      continue;
    }

    const newPath = rewriteFilePath(originalPath, meta.originalUploadDir, currentUploadDir);
    const absolutePath = resolveStoredFilePath(newPath);

    // Ensure directory exists
    const dir = dirname(absolutePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const fileBuffer = await fileInZip.async("nodebuffer");
    await writeFile(absolutePath, fileBuffer);
  }

  return { data, meta };
}
