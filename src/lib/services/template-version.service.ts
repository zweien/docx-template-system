import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { copyToVersion } from "@/lib/file.service";
import type { PlaceholderSnapshotItem } from "@/types/placeholder";
import type {
  TemplateVersionListItem,
  TemplateVersionDetail,
  TemplateFieldMapping,
} from "@/types/template";

// ── Unified return type ──

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

// ── Helpers ──

// Helper to convert to Prisma JSON input (same pattern as data-record.service.ts)
function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}

interface TemplateRowLocked {
  id: string;
  name: string;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  status: string;
  dataTableId: string | null;
  fieldMapping: unknown;
}

function toSnapshotItem(row: {
  key: string;
  label: string;
  inputType: string;
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  enablePicker: boolean;
  sourceTableId: string | null;
  sourceField: string | null;
  description: string | null;
}): PlaceholderSnapshotItem {
  return {
    key: row.key,
    label: row.label,
    inputType: row.inputType as "TEXT" | "TEXTAREA",
    required: row.required,
    defaultValue: row.defaultValue,
    sortOrder: row.sortOrder,
    enablePicker: row.enablePicker,
    sourceTableId: row.sourceTableId,
    sourceField: row.sourceField,
    description: row.description,
    snapshotVersion: 1,
  };
}

// ── Public API ──

export async function publishTemplate(
  templateId: string,
  userId: string
): Promise<ServiceResult<{ version: number; publishedAt: string }>> {
  try {
    return await db.$transaction(async (tx) => {
      // 1. Lock the template row with SELECT ... FOR UPDATE
      const lockedRows = await tx.$queryRaw<TemplateRowLocked[]>`
        SELECT id, name, "fileName", "originalFileName", "fileSize", status, "dataTableId", "fieldMapping"
        FROM "Template"
        WHERE id = ${templateId}
        FOR UPDATE
      `;

      const template = lockedRows[0];
      if (!template) {
        return {
          success: false as const,
          error: { code: "NOT_FOUND", message: "模板不存在" },
        };
      }

      // 2. Verify the template has placeholders (at least 1)
      const placeholderCount = await tx.placeholder.count({
        where: { templateId },
      });
      if (placeholderCount === 0) {
        return {
          success: false as const,
          error: { code: "NO_PLACEHOLDERS", message: "模板没有占位符，无法发布" },
        };
      }

      // 3. Calculate next version number
      const maxVersion = await tx.templateVersion.aggregate({
        where: { templateId },
        _max: { version: true },
      });
      const nextVersion = (maxVersion._max.version ?? 0) + 1;

      // 4. Copy draft file to version file
      const fileMeta = await copyToVersion(templateId, nextVersion);

      // 5. Serialize placeholders to JSON snapshot
      const placeholders = await tx.placeholder.findMany({
        where: { templateId },
        orderBy: { sortOrder: "asc" },
      });
      const snapshot: PlaceholderSnapshotItem[] = placeholders.map(toSnapshotItem);

      // 6. Create TemplateVersion record
      const version = await tx.templateVersion.create({
        data: {
          version: nextVersion,
          fileName: fileMeta.fileName,
          filePath: fileMeta.filePath,
          originalFileName: template.originalFileName,
          fileSize: template.fileSize,
          placeholderSnapshot: toJsonInput(snapshot),
          dataTableId: template.dataTableId,
          fieldMapping: template.fieldMapping
            ? toJsonInput(template.fieldMapping)
            : Prisma.JsonNull,
          publishedById: userId,
          templateId,
        },
      });

      // 7. Update Template: set currentVersionId and status
      await tx.template.update({
        where: { id: templateId },
        data: {
          currentVersionId: version.id,
          status: "PUBLISHED",
        },
      });

      return {
        success: true as const,
        data: {
          version: nextVersion,
          publishedAt: version.publishedAt.toISOString(),
        },
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "发布模板版本失败";
    return { success: false, error: { code: "PUBLISH_FAILED", message } };
  }
}

export async function getVersionHistory(
  templateId: string
): Promise<ServiceResult<TemplateVersionListItem[]>> {
  try {
    const versions = await db.templateVersion.findMany({
      where: { templateId },
      orderBy: { version: "desc" },
      include: {
        publishedBy: { select: { name: true } },
      },
    });

    return {
      success: true,
      data: versions.map((v) => ({
        version: v.version,
        fileName: v.fileName,
        originalFileName: v.originalFileName,
        fileSize: v.fileSize,
        publishedAt: v.publishedAt.toISOString(),
        publishedByName: v.publishedBy.name,
        placeholderCount: (v.placeholderSnapshot as unknown[]).length,
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取版本历史失败";
    return { success: false, error: { code: "HISTORY_FAILED", message } };
  }
}

export async function getVersionDetail(
  templateId: string,
  version: number
): Promise<ServiceResult<TemplateVersionDetail>> {
  try {
    const v = await db.templateVersion.findUnique({
      where: {
        templateId_version: { templateId, version },
      },
      include: {
        publishedBy: { select: { name: true } },
        dataTable: { select: { id: true, name: true } },
      },
    });

    if (!v) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "版本不存在" },
      };
    }

    return {
      success: true,
      data: {
        version: v.version,
        fileName: v.fileName,
        originalFileName: v.originalFileName,
        fileSize: v.fileSize,
        publishedAt: v.publishedAt.toISOString(),
        publishedByName: v.publishedBy.name,
        placeholderCount: (v.placeholderSnapshot as unknown[]).length,
        id: v.id,
        placeholderSnapshot: v.placeholderSnapshot as unknown as PlaceholderSnapshotItem[],
        dataTableId: v.dataTableId,
        dataTable: v.dataTable ?? undefined,
        fieldMapping: v.fieldMapping as TemplateFieldMapping | null,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取版本详情失败";
    return { success: false, error: { code: "DETAIL_FAILED", message } };
  }
}
