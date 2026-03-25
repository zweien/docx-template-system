// src/lib/services/batch-generation.service.ts

import { db } from "@/lib/db";
import { BatchStatus, OutputMethod, RecordStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { PYTHON_SERVICE_URL } from "@/lib/constants";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import archiver from "archiver";
import { createWriteStream } from "fs";

import type { FieldMapping, BatchGenerationInput, BatchGenerationResult } from "@/types/batch-generation";
import { autoMatchFields, buildFormData } from "@/lib/utils/field-mapping";
import { buildFileName, generateUniqueFileName } from "@/lib/utils/file-name-builder";
import { UPLOAD_DIR } from "@/lib/constants/upload";

// ── Unified return type ──

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

// ── Types ──

interface DataTableInfo {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  fieldCount: number;
  recordCount: number;
  createdAt: Date;
}

interface DataFieldInfo {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  sortOrder: number;
}

interface DataRecordInfo {
  id: string;
  tableId: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface PlaceholderInfo {
  id: string;
  key: string;
  label: string;
  inputType: string;
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
}

interface FieldMappingInfoResult {
  placeholders: PlaceholderInfo[];
  dataFields: DataFieldInfo[];
  autoMapping: FieldMapping;
}

interface GeneratedFileInfo {
  fileName: string;
  filePath: string;
  dataRecordId: string;
}

// ── Public API ──

/**
 * 获取所有数据表列表
 */
export async function listDataTables(): Promise<ServiceResult<DataTableInfo[]>> {
  try {
    const tables = await db.dataTable.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { fields: true, records: true },
        },
      },
    });

    return {
      success: true,
      data: tables.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        fieldCount: t._count.fields,
        recordCount: t._count.records,
        createdAt: t.createdAt,
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取数据表列表失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

/**
 * 获取数据表的字段列表
 */
export async function getDataTableFields(
  dataTableId: string
): Promise<ServiceResult<DataFieldInfo[]>> {
  try {
    const fields = await db.dataField.findMany({
      where: { tableId: dataTableId },
      orderBy: { sortOrder: "asc" },
    });

    return {
      success: true,
      data: fields.map((f) => ({
        id: f.id,
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
        sortOrder: f.sortOrder,
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取字段列表失败";
    return { success: false, error: { code: "GET_FIELDS_FAILED", message } };
  }
}

/**
 * 获取数据记录列表（支持分页和筛选）
 */
export async function listDataRecords(
  dataTableId: string,
  filters: { page: number; pageSize: number; recordIds?: string[] }
): Promise<
  ServiceResult<{
    items: DataRecordInfo[];
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  try {
    const where: Record<string, unknown> = { tableId: dataTableId };

    // 如果提供了特定的记录ID列表，则只获取这些记录
    if (filters.recordIds && filters.recordIds.length > 0) {
      where.id = { in: filters.recordIds };
    }

    const [records, total] = await Promise.all([
      db.dataRecord.findMany({
        where,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        orderBy: { createdAt: "desc" },
      }),
      db.dataRecord.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: records.map((r) => ({
          id: r.id,
          tableId: r.tableId,
          data: r.data as Record<string, unknown>,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
        total,
        page: filters.page,
        pageSize: filters.pageSize,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取数据记录失败";
    return { success: false, error: { code: "LIST_RECORDS_FAILED", message } };
  }
}

/**
 * 获取字段映射信息（占位符、数据字段、自动映射）
 */
export async function getFieldMappingInfo(
  templateId: string,
  dataTableId: string
): Promise<ServiceResult<FieldMappingInfoResult>> {
  try {
    // 获取模板和占位符
    const template = await db.template.findUnique({
      where: { id: templateId },
      include: {
        placeholders: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!template) {
      return {
        success: false,
        error: { code: "TEMPLATE_NOT_FOUND", message: "模板不存在" },
      };
    }

    // 获取数据表字段
    const fields = await db.dataField.findMany({
      where: { tableId: dataTableId },
      orderBy: { sortOrder: "asc" },
    });

    const placeholders: PlaceholderInfo[] = template.placeholders.map((p) => ({
      id: p.id,
      key: p.key,
      label: p.label,
      inputType: p.inputType,
      required: p.required,
      defaultValue: p.defaultValue,
      sortOrder: p.sortOrder,
    }));

    const dataFields: DataFieldInfo[] = fields.map((f) => ({
      id: f.id,
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      sortOrder: f.sortOrder,
    }));

    // 自动匹配字段
    const autoMapping = autoMatchFields(
      placeholders.map((p) => ({ key: p.key, label: p.label })),
      dataFields.map((f) => ({ key: f.key, label: f.label }))
    );

    return {
      success: true,
      data: {
        placeholders,
        dataFields,
        autoMapping,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取字段映射信息失败";
    return { success: false, error: { code: "GET_MAPPING_INFO_FAILED", message } };
  }
}

/**
 * 执行批量生成（主函数）
 */
export async function generateBatch(
  userId: string,
  input: BatchGenerationInput
): Promise<ServiceResult<BatchGenerationResult>> {
  try {
    // 1. 验证模板和数据表存在
    const template = await db.template.findUnique({
      where: { id: input.templateId },
      include: {
        placeholders: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!template) {
      return {
        success: false,
        error: { code: "TEMPLATE_NOT_FOUND", message: "模板不存在" },
      };
    }

    const dataTable = await db.dataTable.findUnique({
      where: { id: input.dataTableId },
    });

    if (!dataTable) {
      return {
        success: false,
        error: { code: "DATA_TABLE_NOT_FOUND", message: "数据表不存在" },
      };
    }

    // 2. 获取数据记录
    const dataRecords = await db.dataRecord.findMany({
      where: {
        id: { in: input.recordIds },
        tableId: input.dataTableId,
      },
    });

    if (dataRecords.length === 0) {
      return {
        success: false,
        error: { code: "NO_RECORDS", message: "没有找到有效的数据记录" },
      };
    }

    // 3. 创建批量生成记录
    const batchGeneration = await db.batchGeneration.create({
      data: {
        templateId: input.templateId,
        dataTableId: input.dataTableId,
        totalCount: dataRecords.length,
        successCount: 0,
        failedCount: 0,
        status: BatchStatus.PROCESSING,
        fileNamePattern: input.fileNamePattern,
        outputMethod: input.outputMethod as OutputMethod,
        createdById: userId,
      },
    });

    const generatedFiles: GeneratedFileInfo[] = [];
    const errors: Array<{ recordId: string; error: string }> = [];

    // 收集待创建的 Record 数据
    const recordsToCreate: Array<{
      templateId: string;
      userId: string;
      formData: Record<string, unknown>;
      status: RecordStatus;
      fileName?: string;
      filePath?: string;
      errorMessage?: string;
      dataRecordId: string;
    }> = [];

    // 确保输出目录存在
    const documentsDir = join(process.cwd(), UPLOAD_DIR, "documents");
    if (!existsSync(documentsDir)) {
      await mkdir(documentsDir, { recursive: true });
    }

    // 用于生成唯一文件名的集合
    const existingFileNames = new Set<string>();

    // 4. 循环处理每条记录
    for (let index = 0; index < dataRecords.length; index++) {
      const dataRecord = dataRecords[index];
      const recordIndex = index + 1;

      try {
        // 构建表单数据
        const recordData = dataRecord.data as Record<string, unknown>;
        const formData = buildFormData(input.fieldMapping, recordData);

        // 生成文件名
        let fileName = buildFileName(input.fileNamePattern, recordData, recordIndex);
        // 确保文件名以 .docx 结尾
        if (!fileName.endsWith(".docx")) {
          fileName = `${fileName}.docx`;
        }
        // 生成唯一文件名
        fileName = generateUniqueFileName(fileName, existingFileNames);
        existingFileNames.add(fileName);

        // 调用 Python 服务生成文档
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60秒超时

        try {
          const response = await fetch(`${PYTHON_SERVICE_URL}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              template_path: template.filePath,
              output_filename: fileName,
              form_data: formData,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMessage =
              (errorData as { detail?: string })?.detail ||
              `Python 服务返回错误: ${response.status}`;
            throw new Error(errorMessage);
          }

          // 保存生成的文件
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const filePath = join(documentsDir, fileName);
          await writeFile(filePath, buffer);

          // 收集成功的 Record 数据
          recordsToCreate.push({
            templateId: input.templateId,
            userId,
            formData,
            status: RecordStatus.COMPLETED,
            fileName,
            filePath,
            dataRecordId: dataRecord.id,
          });

          generatedFiles.push({
            fileName,
            filePath,
            dataRecordId: dataRecord.id,
          });
        } catch (fetchError) {
          clearTimeout(timeoutId);

          if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
            throw new Error("文档生成超时（60秒）");
          }
          throw fetchError;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "文档生成失败";
        errors.push({
          recordId: dataRecord.id,
          error: errorMessage,
        });

        // 收集失败的 Record 数据
        recordsToCreate.push({
          templateId: input.templateId,
          userId,
          formData: buildFormData(input.fieldMapping, dataRecord.data as Record<string, unknown>),
          status: RecordStatus.FAILED,
          errorMessage,
          dataRecordId: dataRecord.id,
        });
      }
    }

    // 批量创建所有 Record 记录
    if (recordsToCreate.length > 0) {
      await db.record.createMany({
        data: recordsToCreate as Prisma.RecordCreateManyInput[],
      });
    }

    const successCount = recordsToCreate.filter((r) => r.status === RecordStatus.COMPLETED).length;
    const failedCount = recordsToCreate.filter((r) => r.status === RecordStatus.FAILED).length;

    // 5. 更新批量生成记录
    let downloadUrl: string | undefined;

    if (input.outputMethod === "DOWNLOAD" && generatedFiles.length > 0) {
      // 创建 ZIP 压缩包
      downloadUrl = await createZipArchive(batchGeneration.id, generatedFiles);
    }

    // 更新批量生成状态
    const finalStatus = failedCount === 0 ? BatchStatus.COMPLETED :
                        successCount === 0 ? BatchStatus.FAILED :
                        BatchStatus.COMPLETED;

    await db.batchGeneration.update({
      where: { id: batchGeneration.id },
      data: {
        status: finalStatus,
        successCount,
        failedCount,
      },
    });

    return {
      success: true,
      data: {
        success: true,
        batchId: batchGeneration.id,
        generatedRecords: generatedFiles.map((f) => ({
          id: f.fileName, // 使用 fileName 作为 ID
          fileName: f.fileName,
          dataRecordId: f.dataRecordId,
        })),
        errors: errors.length > 0 ? errors : undefined,
        downloadUrl,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "批量生成失败";
    return { success: false, error: { code: "BATCH_GENERATION_FAILED", message } };
  }
}

/**
 * 创建 ZIP 压缩包
 */
async function createZipArchive(
  batchId: string,
  files: GeneratedFileInfo[]
): Promise<string> {
  const batchesDir = join(process.cwd(), UPLOAD_DIR, "batches");

  // 确保目录存在
  async function ensureDir() {
    if (!existsSync(batchesDir)) {
      await mkdir(batchesDir, { recursive: true });
    }
  }

  await ensureDir();

  return new Promise((resolve, reject) => {
    const zipPath = join(batchesDir, `batch-${batchId}.zip`);
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", {
      zlib: { level: 9 }, // 最高压缩级别
    });

    output.on("close", () => {
      resolve(`/uploads/batches/batch-${batchId}.zip`);
    });

    archive.on("error", (err) => {
      reject(err);
    });

    archive.pipe(output);

    // 添加文件到 ZIP
    for (const file of files) {
      if (existsSync(file.filePath)) {
        archive.file(file.filePath, { name: file.fileName });
      }
    }

    archive.finalize();
  });
}

/**
 * 获取批量生成记录详情
 */
export async function getBatch(
  batchId: string
): Promise<
  ServiceResult<{
    id: string;
    templateId: string;
    dataTableId: string;
    totalCount: number;
    successCount: number;
    failedCount: number;
    status: string;
    fileNamePattern: string | null;
    outputMethod: string;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    template: { name: string };
    dataTable: { name: string };
    createdBy: { name: string };
  }>
> {
  try {
    const batch = await db.batchGeneration.findUnique({
      where: { id: batchId },
      include: {
        template: { select: { name: true } },
        dataTable: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });

    if (!batch) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "批量生成记录不存在" },
      };
    }

    return {
      success: true,
      data: {
        id: batch.id,
        templateId: batch.templateId,
        dataTableId: batch.dataTableId,
        totalCount: batch.totalCount,
        successCount: batch.successCount,
        failedCount: batch.failedCount,
        status: batch.status,
        fileNamePattern: batch.fileNamePattern,
        outputMethod: batch.outputMethod,
        createdById: batch.createdById,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
        template: batch.template,
        dataTable: batch.dataTable,
        createdBy: batch.createdBy,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取批量生成记录失败";
    return { success: false, error: { code: "GET_BATCH_FAILED", message } };
  }
}

/**
 * 获取批量生成记录列表
 */
export async function listBatches(
  filters: { page: number; pageSize: number; status?: string }
): Promise<
  ServiceResult<{
    items: Array<{
      id: string;
      templateId: string;
      dataTableId: string;
      totalCount: number;
      successCount: number;
      failedCount: number;
      status: string;
      fileNamePattern: string | null;
      outputMethod: string;
      createdAt: Date;
      updatedAt: Date;
      template: { name: string };
      dataTable: { name: string };
      createdBy: { name: string };
    }>;
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  try {
    const where: Record<string, unknown> = {};
    if (filters.status) {
      where.status = filters.status;
    }

    const [items, total] = await Promise.all([
      db.batchGeneration.findMany({
        where,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          template: { select: { name: true } },
          dataTable: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
      }),
      db.batchGeneration.count({ where }),
    ]);

    return {
      success: true,
      data: { items, total, page: filters.page, pageSize: filters.pageSize },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取批量生成列表失败";
    return { success: false, error: { code: "LIST_BATCHES_FAILED", message } };
  }
}
