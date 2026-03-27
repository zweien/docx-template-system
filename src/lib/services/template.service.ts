import { db } from "@/lib/db";
import { saveTemplateDraft, deleteTemplateDir, type FilePathMeta } from "@/lib/file.service";
import type { TemplateListItem, TemplateWithRelation } from "@/types/template";
import type { PlaceholderItem } from "@/types/placeholder";

// ── Unified return type ──

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

// ── Helpers ──

function mapTemplateToListItem(row: {
  id: string;
  name: string;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  status: string;
  createdAt: Date;
}): TemplateListItem {
  return {
    id: row.id,
    name: row.name,
    fileName: row.fileName,
    originalFileName: row.originalFileName,
    fileSize: row.fileSize,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapPlaceholderItem(row: {
  id: string;
  key: string;
  label: string;
  inputType: string;
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  sourceTableId: string | null;
  sourceField: string | null;
  enablePicker: boolean;
}): PlaceholderItem {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    inputType: row.inputType,
    required: row.required,
    defaultValue: row.defaultValue,
    sortOrder: row.sortOrder,
    sourceTableId: row.sourceTableId,
    sourceField: row.sourceField,
    enablePicker: row.enablePicker,
  };
}

// ── Public API ──

export async function listTemplates(filters: {
  page: number;
  pageSize: number;
  status?: string;
}): Promise<ServiceResult<{
  items: TemplateListItem[];
  total: number;
  page: number;
  pageSize: number;
}>> {
  try {
    const where: Record<string, unknown> = {};
    if (filters.status) {
      where.status = filters.status;
    }

    const [rows, total] = await Promise.all([
      db.template.findMany({
        where,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { name: true } },
        },
      }),
      db.template.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: rows.map((r) => mapTemplateToListItem(r)),
        total,
        page: filters.page,
        pageSize: filters.pageSize,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取模板列表失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

export async function getTemplate(
  id: string
): Promise<ServiceResult<TemplateWithRelation>> {
  try {
    const template = await db.template.findUnique({
      where: { id },
      include: {
        placeholders: { orderBy: { sortOrder: "asc" } },
        createdBy: { select: { name: true } },
        // P2: 包含关联的数据表信息
        dataTable: { select: { id: true, name: true } },
        currentVersion: {
          select: {
            id: true,
            version: true,
            publishedAt: true,
            publishedBy: { select: { name: true } },
          },
        },
      },
    });

    if (!template) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "模板不存在" },
      };
    }

    return {
      success: true,
      data: {
        ...mapTemplateToListItem(template),
        description: template.description,
        createdById: template.createdById,
        placeholders: template.placeholders.map(mapPlaceholderItem),
        // P2: 返回关联信息
        dataTableId: template.dataTableId,
        dataTable: template.dataTable ?? undefined,
        fieldMapping: template.fieldMapping as Record<string, string | null> | null,
        currentVersion: template.currentVersion
          ? {
              id: template.currentVersion.id,
              version: template.currentVersion.version,
              publishedAt: template.currentVersion.publishedAt.toISOString(),
              publishedByName: template.currentVersion.publishedBy.name,
            }
          : null,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取模板详情失败";
    return { success: false, error: { code: "GET_FAILED", message } };
  }
}

export async function createTemplate(
  data: { name: string; description?: string; createdById: string },
  fileBuffer: Buffer,
  originalName: string
): Promise<ServiceResult<TemplateListItem>> {
  try {
    const id = crypto.randomUUID();

    const fileMeta: FilePathMeta = await saveTemplateDraft(id, fileBuffer, originalName);

    const template = await db.template.create({
      data: {
        id,
        name: data.name,
        description: data.description ?? null,
        fileName: fileMeta.fileName,
        originalFileName: originalName,
        filePath: fileMeta.filePath,
        fileSize: fileBuffer.length,
        status: "DRAFT",
        createdById: data.createdById,
      },
    });

    return { success: true, data: mapTemplateToListItem(template) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建模板失败";
    return { success: false, error: { code: "CREATE_FAILED", message } };
  }
}

export async function updateTemplate(
  id: string,
  data: {
    name?: string;
    description?: string;
    // P2: 新增字段
    dataTableId?: string | null;
    fieldMapping?: Record<string, string | null>;
  }
): Promise<ServiceResult<TemplateListItem>> {
  try {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    // P2: 处理关联字段
    if (data.dataTableId !== undefined) updateData.dataTableId = data.dataTableId;
    if (data.fieldMapping !== undefined) {
      updateData.fieldMapping = data.fieldMapping;
    }

    const template = await db.template.update({
      where: { id },
      data: updateData,
    });

    return { success: true, data: mapTemplateToListItem(template) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新模板失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}

export async function deleteTemplate(id: string): Promise<ServiceResult<null>> {
  try {
    const template = await db.template.findUnique({ where: { id } });

    if (!template) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "模板不存在" },
      };
    }

    await db.template.delete({ where: { id } });
    await deleteTemplateDir(id);

    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除模板失败";
    return { success: false, error: { code: "DELETE_FAILED", message } };
  }
}

export async function changeStatus(
  id: string,
  status: string
): Promise<ServiceResult<TemplateListItem>> {
  try {
    const template = await db.template.update({
      where: { id },
      data: { status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED" },
    });

    return { success: true, data: mapTemplateToListItem(template) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新模板状态失败";
    return { success: false, error: { code: "STATUS_CHANGE_FAILED", message } };
  }
}
