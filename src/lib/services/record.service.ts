import { db } from "@/lib/db";
import { RecordStatus } from "@/generated/prisma/enums";
import { PYTHON_SERVICE_URL } from "@/lib/constants";
import { UPLOAD_DIR } from "@/lib/constants/upload";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// ── Unified return type ──

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

// ── Public API ──

export async function listRecords(
  userId: string,
  filters: { page: number; pageSize: number; status?: string }
): Promise<
  ServiceResult<{
    items: {
      id: string;
      templateId: string;
      formData: unknown;
      status: string;
      fileName: string | null;
      filePath: string | null;
      errorMessage: string | null;
      createdAt: Date;
      updatedAt: Date;
      template: { name: string };
    }[];
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  try {
    const where: Record<string, unknown> = { userId };
    if (filters.status) {
      where.status = filters.status;
    }

    const [items, total] = await Promise.all([
      db.record.findMany({
        where,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        orderBy: { createdAt: "desc" },
        include: { template: { select: { name: true } } },
      }),
      db.record.count({ where }),
    ]);

    return {
      success: true,
      data: { items, total, page: filters.page, pageSize: filters.pageSize },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取记录列表失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

export async function getRecord(
  id: string
): Promise<
  ServiceResult<{
    id: string;
    templateId: string;
    userId: string;
    formData: unknown;
    status: string;
    fileName: string | null;
    filePath: string | null;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
    template: { name: string };
  } | null>
> {
  try {
    const record = await db.record.findUnique({
      where: { id },
      include: { template: { select: { name: true } } },
    });

    if (!record) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "记录不存在" },
      };
    }

    return { success: true, data: record };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取记录失败";
    return { success: false, error: { code: "GET_FAILED", message } };
  }
}

export async function createRecord(
  userId: string,
  templateId: string,
  formData: Record<string, string>
): Promise<
  ServiceResult<{
    id: string;
    templateId: string;
    userId: string;
    formData: unknown;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }>
> {
  try {
    const record = await db.record.create({
      data: {
        templateId,
        userId,
        formData,
        status: RecordStatus.PENDING,
      },
    });

    return { success: true, data: record };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建记录失败";
    return { success: false, error: { code: "CREATE_FAILED", message } };
  }
}

export async function generateDocument(
  recordId: string
): Promise<
  ServiceResult<{
    id: string;
    status: string;
    fileName: string | null;
    filePath: string | null;
    errorMessage: string | null;
  }>
> {
  try {
    // a. Get the record with template
    const record = await db.record.findUnique({
      where: { id: recordId },
      include: {
        template: {
          select: {
            name: true,
            currentVersion: { select: { filePath: true } },
          },
        },
      },
    });

    if (!record) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "记录不存在" },
      };
    }

    const templatePath = record.template.currentVersion?.filePath;
    if (!templatePath) {
      return {
        success: false,
        error: { code: "NO_VERSION", message: "模板尚未发布，无法生成文档" },
      };
    }

    // b. Update record status to PENDING
    await db.record.update({
      where: { id: recordId },
      data: { status: RecordStatus.PENDING },
    });

    // c. Generate output filename
    const now = new Date();
    const yyyy = now.getFullYear().toString().padStart(4, "0");
    const MM = (now.getMonth() + 1).toString().padStart(2, "0");
    const dd = now.getDate().toString().padStart(2, "0");
    const HH = now.getHours().toString().padStart(2, "0");
    const mm = now.getMinutes().toString().padStart(2, "0");
    const ss = now.getSeconds().toString().padStart(2, "0");
    const newFileName = `${record.template.name}_${yyyy}${MM}${dd}_${HH}${mm}${ss}.docx`;

    // d. Call Python service
    const formData = record.formData as Record<string, string>;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(`${PYTHON_SERVICE_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_path: templatePath,
          output_filename: newFileName,
          form_data: formData,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const message = (errorData as { detail?: string })?.detail || `Python 服务返回错误: ${response.status}`;
        await db.record.update({
          where: { id: recordId },
          data: { status: RecordStatus.FAILED, errorMessage: message },
        });
        return { success: false, error: { code: "GENERATE_FAILED", message } };
      }

      // e. Save generated file from response
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const targetDir = join(process.cwd(), UPLOAD_DIR, "documents");
      if (!existsSync(targetDir)) await mkdir(targetDir, { recursive: true });
      const filePath = join(targetDir, newFileName);
      await writeFile(filePath, buffer);

      // f. Update record as COMPLETED
      const updated = await db.record.update({
        where: { id: recordId },
        data: {
          status: RecordStatus.COMPLETED,
          fileName: newFileName,
          filePath,
          errorMessage: null,
        },
      });

      return {
        success: true,
        data: {
          id: updated.id,
          status: updated.status,
          fileName: updated.fileName,
          filePath: updated.filePath,
          errorMessage: updated.errorMessage,
        },
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
        const message = "文档生成超时（30秒）";
        await db.record.update({
          where: { id: recordId },
          data: { status: RecordStatus.FAILED, errorMessage: message },
        });
        return { success: false, error: { code: "GENERATE_TIMEOUT", message } };
      }
      throw fetchError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "文档生成失败";
    try {
      await db.record.update({
        where: { id: recordId },
        data: { status: RecordStatus.FAILED, errorMessage: message },
      });
    } catch {
      // Ignore update errors in the catch block
    }
    return { success: false, error: { code: "GENERATE_FAILED", message } };
  }
}

export async function copyRecordToDraft(
  userId: string,
  recordId: string
): Promise<
  ServiceResult<{
    id: string;
    templateId: string;
    userId: string;
    formData: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>
> {
  try {
    // Get the record
    const record = await db.record.findUnique({ where: { id: recordId } });

    if (!record) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "记录不存在" },
      };
    }

    // Create a new draft with the record's templateId and formData
    const draft = await db.draft.create({
      data: {
        userId,
        templateId: record.templateId,
        formData: record.formData as Record<string, string>,
      },
    });

    return { success: true, data: draft };
  } catch (error) {
    const message = error instanceof Error ? error.message : "复制记录到草稿失败";
    return { success: false, error: { code: "COPY_FAILED", message } };
  }
}
