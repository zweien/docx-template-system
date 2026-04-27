import { db } from "@/lib/db";
import { saveReportTemplateFile, deleteReportTemplateFile } from "@/lib/file.service";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

const REPORT_ENGINE_URL = process.env.REPORT_ENGINE_URL || "http://localhost:8066";

interface ReportTemplateListItem {
  id: string;
  name: string;
  originalFilename: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function listReportTemplates(userId: string): Promise<ServiceResult<ReportTemplateListItem[]>> {
  try {
    const templates = await db.reportTemplate.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, originalFilename: true,
        createdAt: true, updatedAt: true,
      },
    });
    return { success: true, data: templates };
  } catch {
    return { success: false, error: { code: "LIST_FAILED", message: "获取报告模板列表失败" } };
  }
}

export async function createReportTemplate(
  userId: string,
  file: File
): Promise<ServiceResult<Record<string, unknown>>> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.replace(/\.docx$/i, "");

    const template = await db.reportTemplate.create({
      data: { userId, name, originalFilename: file.name, filePath: "", parsedStructure: {} },
    });

    const meta = await saveReportTemplateFile(buffer, file.name, template.id);

    const parseResult = await fetch(`${REPORT_ENGINE_URL}/parse-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_path: meta.filePath }),
    });

    let parsedStructure = {};
    if (parseResult.ok) {
      const parseData = await parseResult.json();
      parsedStructure = parseData.structure || {};
    }

    await db.reportTemplate.update({
      where: { id: template.id },
      data: { filePath: meta.filePath, parsedStructure },
    });

    return {
      success: true,
      data: {
        id: template.id,
        name,
        originalFilename: file.name,
        parsedStructure,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      },
    };
  } catch (e: unknown) {
    return { success: false, error: { code: "CREATE_FAILED", message: e instanceof Error ? e.message : "创建报告模板失败" } };
  }
}

export async function renameReportTemplate(
  id: string,
  userId: string,
  name: string
): Promise<ServiceResult<void>> {
  try {
    const template = await db.reportTemplate.findUnique({ where: { id } });
    if (!template || template.userId !== userId) {
      return { success: false, error: { code: "NOT_FOUND", message: "报告模板不存在" } };
    }
    await db.reportTemplate.update({ where: { id }, data: { name } });
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: { code: "RENAME_FAILED", message: "重命名报告模板失败" } };
  }
}

export async function deleteReportTemplate(
  id: string,
  userId: string
): Promise<ServiceResult<void>> {
  try {
    const template = await db.reportTemplate.findUnique({ where: { id } });
    if (!template || template.userId !== userId) {
      return { success: false, error: { code: "NOT_FOUND", message: "报告模板不存在" } };
    }
    await db.reportTemplate.delete({ where: { id } });
    await deleteReportTemplateFile(template.filePath);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: { code: "DELETE_FAILED", message: "删除报告模板失败" } };
  }
}
