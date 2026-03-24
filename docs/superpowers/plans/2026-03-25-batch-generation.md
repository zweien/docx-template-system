# 批量生成功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现基于主数据的批量文档生成功能，包含4步向导流程（选择数据源 → 字段映射 → 生成设置 → 执行结果）

**Architecture:** 三层架构（types/validators/services）+ API routes + React Client Components。批量生成服务调用 Python docx 服务生成文档，支持 ZIP 打包下载。

**Tech Stack:** Next.js 16, Prisma 7, PostgreSQL, shadcn/ui v4 (Base UI), Zod, Archiver (ZIP)

**Spec:** docs/superpowers/specs/2026-03-24-batch-generation-design.md

---

## File Structure

```
prisma/
  schema.prisma                    # 修改: 添加 BatchGeneration, 扩展 Template/Record

src/
  types/
    batch-generation.ts            # 新建: TypeScript 类型定义

  validators/
    batch-generation.ts            # 新建: Zod 验证器

  lib/
    services/
      batch-generation.service.ts  # 新建: 批量生成服务
    utils/
      field-mapping.ts             # 新建: 字段映射工具
      file-name-builder.ts         # 新建: 文件名生成工具

  app/
    api/
      templates/[id]/
        batch/
          route.ts                 # 新建: POST 批量生成 API
      batch/
        [id]/
          route.ts                 # 新建: GET 批次状态 API
          download/
            route.ts               # 新建: GET 下载 ZIP API

    (dashboard)/
      templates/[id]/
        batch/
          page.tsx                 # 新建: 批量生成页面

  components/
    batch/
      step-indicator.tsx           # 新建: 步骤指示器
      step-navigation.tsx          # 新建: 步骤导航按钮
      step1-select-data.tsx        # 新建: 步骤1 - 选择数据源
      step2-field-mapping.tsx      # 新建: 步骤2 - 字段映射
      step3-settings.tsx           # 新建: 步骤3 - 生成设置
      step4-result.tsx             # 新建: 步骤4 - 执行结果
```

---

## Task 1: 扩展 Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 添加 BatchStatus 枚举和 BatchGeneration 模型**

在 `prisma/schema.prisma` 文件末尾添加：

```prisma
// ========== Batch Generation (Phase 2b) ==========

enum BatchStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model BatchGeneration {
  id              String      @id @default(cuid())
  templateId      String
  template        Template    @relation(fields: [templateId], references: [id])
  dataTableId     String
  dataTable       DataTable   @relation(fields: [dataTableId], references: [id])
  totalCount      Int
  successCount    Int         @default(0)
  failedCount     Int         @default(0)
  status          BatchStatus @default(PENDING)
  fileNamePattern String?
  outputMethod    String      // DOWNLOAD / SAVE_TO_RECORDS
  createdById     String
  createdBy       User        @relation(fields: [createdById], references: [id])
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([templateId])
  @@index([status])
}
```

- [ ] **Step 2: 扩展 Template 模型添加主数据关联**

在 `model Template` 中添加字段（在 `records` 关系之前）：

```prisma
  dataTableId    String?
  dataTable      DataTable?  @relation(fields: [dataTableId], references: [id])
  fieldMapping   Json?
  batchGenerations BatchGeneration[]
```

- [ ] **Step 3: 扩展 Record 模型添加主数据关联**

在 `model Record` 中添加字段（在现有字段后）：

```prisma
  dataRecordId   String?
  dataRecord     DataRecord? @relation(fields: [dataRecordId], references: [id])
```

- [ ] **Step 4: 扩展 DataTable 和 User 模型添加反向关系**

在 `model DataTable` 中添加：
```prisma
  templates        Template[]
  batchGenerations BatchGeneration[]
```

在 `model DataRecord` 中添加：
```prisma
  records Record[]
```

在 `model User` 中添加：
```prisma
  batchGenerations BatchGeneration[]
```

- [ ] **Step 5: 运行 prisma db push 和 generate**

```bash
npx prisma db push
npx prisma generate
```

Expected: 无错误，数据库 schema 更新成功

- [ ] **Step 6: 提交 Schema 变更**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add BatchGeneration model and extend Template/Record for batch generation"
```

---

## Task 2: 创建类型定义

**Files:**
- Create: `src/types/batch-generation.ts`

- [ ] **Step 1: 创建类型定义文件**

```typescript
// src/types/batch-generation.ts

import { BatchStatus } from "@/generated/prisma/enums";

export interface BatchGenerationItem {
  id: string;
  templateId: string;
  dataTableId: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  status: BatchStatus;
  fileNamePattern: string | null;
  outputMethod: "DOWNLOAD" | "SAVE_TO_RECORDS";
  createdAt: Date;
  updatedAt: Date;
  createdByName: string;
}

export interface FieldMapping {
  [placeholderKey: string]: string | null; // dataFieldKey or null
}

export interface BatchGenerationInput {
  templateId: string;
  dataTableId: string;
  recordIds: string[];
  fieldMapping: FieldMapping;
  fileNamePattern: string;
  outputMethod: "DOWNLOAD" | "SAVE_TO_RECORDS";
}

export interface GeneratedRecord {
  id: string;
  fileName: string;
  dataRecordId: string;
}

export interface BatchGenerationError {
  recordId: string;
  error: string;
}

export interface BatchGenerationResult {
  success: boolean;
  batchId?: string;
  generatedRecords?: GeneratedRecord[];
  errors?: BatchGenerationError[];
  downloadUrl?: string;
}

export interface FieldMappingValidation {
  valid: boolean;
  errors: string[];
  autoMapping: FieldMapping;
}

export interface Settings {
  fileNamePattern: string;
  outputMethod: "DOWNLOAD" | "SAVE_TO_RECORDS";
}
```

- [ ] **Step 2: 提交类型定义**

```bash
git add src/types/batch-generation.ts
git commit -m "feat(types): add batch generation type definitions"
```

---

## Task 3: 创建 Zod 验证器

**Files:**
- Create: `src/validators/batch-generation.ts`

- [ ] **Step 1: 创建验证器文件**

```typescript
// src/validators/batch-generation.ts

import { z } from "zod";

export const fieldMappingSchema = z.record(z.string(), z.string().nullable());

export const batchGenerationInputSchema = z.object({
  dataTableId: z.string().min(1, "请选择主数据表"),
  recordIds: z.array(z.string().min(1)).min(1, "请至少选择一条记录"),
  fieldMapping: fieldMappingSchema,
  fileNamePattern: z.string().min(1, "请输入文件名规则"),
  outputMethod: z.enum(["DOWNLOAD", "SAVE_TO_RECORDS"]),
});

export const batchQuerySchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]).optional(),
});
```

- [ ] **Step 2: 提交验证器**

```bash
git add src/validators/batch-generation.ts
git commit -m "feat(validators): add batch generation input validation"
```

---

## Task 4: 创建字段映射工具函数

**Files:**
- Create: `src/lib/utils/field-mapping.ts`

- [ ] **Step 1: 创建字段映射工具**

```typescript
// src/lib/utils/field-mapping.ts

import type { FieldMapping } from "@/types/batch-generation";

interface Placeholder {
  key: string;
  label: string;
}

interface DataField {
  key: string;
  label: string;
}

/**
 * 自动匹配占位符到数据字段
 * 匹配优先级: 精确匹配 > 驼峰转下划线 > 模糊匹配
 */
export function autoMatchFields(
  placeholders: Placeholder[],
  dataFields: DataField[]
): FieldMapping {
  const mapping: FieldMapping = {};

  for (const placeholder of placeholders) {
    // 1. 精确匹配（忽略大小写）
    const exactMatch = dataFields.find(
      (f) => f.key.toLowerCase() === placeholder.key.toLowerCase()
    );

    if (exactMatch) {
      mapping[placeholder.key] = exactMatch.key;
      continue;
    }

    // 2. 驼峰转下划线匹配
    const snakeCase = placeholder.key
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase();
    const snakeMatch = dataFields.find((f) => f.key === snakeCase);

    if (snakeMatch) {
      mapping[placeholder.key] = snakeMatch.key;
      continue;
    }

    // 3. 模糊匹配（包含关系）
    const fuzzyMatch = dataFields.find(
      (f) =>
        f.key.toLowerCase().includes(placeholder.key.toLowerCase()) ||
        placeholder.key.toLowerCase().includes(f.key.toLowerCase())
    );

    if (fuzzyMatch) {
      mapping[placeholder.key] = fuzzyMatch.key;
      continue;
    }

    // 4. 未匹配
    mapping[placeholder.key] = null;
  }

  return mapping;
}

/**
 * 验证字段映射是否完整（所有必填占位符都有映射）
 */
export function validateFieldMapping(
  mapping: FieldMapping,
  requiredPlaceholders: string[]
): { valid: boolean; missingFields: string[] } {
  const missingFields = requiredPlaceholders.filter(
    (key) => !mapping[key] || mapping[key] === null
  );

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * 根据映射关系构建表单数据
 */
export function buildFormData(
  mapping: FieldMapping,
  recordData: Record<string, unknown>
): Record<string, string> {
  const formData: Record<string, string> = {};

  for (const [placeholderKey, dataFieldKey] of Object.entries(mapping)) {
    if (dataFieldKey && recordData[dataFieldKey] !== undefined) {
      formData[placeholderKey] = String(recordData[dataFieldKey] ?? "");
    } else {
      formData[placeholderKey] = "";
    }
  }

  return formData;
}
```

- [ ] **Step 2: 提交字段映射工具**

```bash
git add src/lib/utils/field-mapping.ts
git commit -m "feat(utils): add field mapping utility functions"
```

---

## Task 5: 创建文件名生成工具

**Files:**
- Create: `src/lib/utils/file-name-builder.ts`

- [ ] **Step 1: 创建文件名生成工具**

```typescript
// src/lib/utils/file-name-builder.ts

/**
 * 可用的文件名变量
 */
export const FILE_NAME_VARIABLES = [
  { key: "{date}", description: "当前日期 (YYYY-MM-DD)" },
  { key: "{time}", description: "当前时间 (HHmmss)" },
  { key: "{序号}", description: "批量生成序号 (从1开始)" },
];

/**
 * 获取可用的字段变量列表
 */
export function getFieldVariables(
  dataFields: { key: string; label: string }[]
): { key: string; description: string }[] {
  return dataFields.map((f) => ({
    key: `{${f.key}}`,
    description: f.label,
  }));
}

/**
 * 根据模式构建文件名
 * @param pattern 文件名模式，如 "{project_name}_合同_{date}"
 * @param recordData 数据记录
 * @param index 批量生成时的序号（从1开始）
 */
export function buildFileName(
  pattern: string,
  recordData: Record<string, unknown>,
  index: number = 1
): string {
  const now = new Date();
  const yyyy = now.getFullYear().toString().padStart(4, "0");
  const MM = (now.getMonth() + 1).toString().padStart(2, "0");
  const dd = now.getDate().toString().padStart(2, "0");
  const HH = now.getHours().toString().padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");
  const ss = now.getSeconds().toString().padStart(2, "0");

  let fileName = pattern;

  // 替换内置变量
  fileName = fileName.replace(/{date}/g, `${yyyy}-${MM}-${dd}`);
  fileName = fileName.replace(/{time}/g, `${HH}${mm}${ss}`);
  fileName = fileName.replace(/{序号}/g, String(index));

  // 替换字段变量
  for (const [key, value] of Object.entries(recordData)) {
    fileName = fileName.replace(new RegExp(`{${key}}`, "g"), String(value ?? ""));
  }

  // 清理文件名中的非法字符
  fileName = fileName.replace(/[<>:"/\\|?*]/g, "_");

  return fileName;
}

/**
 * 生成唯一的文件名（如果存在同名文件则添加序号）
 */
export function generateUniqueFileName(
  baseName: string,
  existingNames: Set<string>
): string {
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  const extIndex = baseName.lastIndexOf(".");
  const name = extIndex > 0 ? baseName.substring(0, extIndex) : baseName;
  const ext = extIndex > 0 ? baseName.substring(extIndex) : "";

  let counter = 2;
  while (existingNames.has(`${name} (${counter})${ext}`)) {
    counter++;
  }

  return `${name} (${counter})${ext}`;
}
```

- [ ] **Step 2: 提交文件名生成工具**

```bash
git add src/lib/utils/file-name-builder.ts
git commit -m "feat(utils): add file name builder utility"
```

---

## Task 6: 创建批量生成服务

**Files:**
- Create: `src/lib/services/batch-generation.service.ts`

- [ ] **Step 1: 创建批量生成服务**

```typescript
// src/lib/services/batch-generation.service.ts

import { db } from "@/lib/db";
import { BatchStatus, RecordStatus } from "@/generated/prisma/enums";
import { PYTHON_SERVICE_URL } from "@/lib/constants";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import archiver from "archiver";
import { createWriteStream } from "fs";
import type {
  BatchGenerationInput,
  BatchGenerationResult,
  BatchGenerationItem,
  FieldMapping,
} from "@/types/batch-generation";
import { autoMatchFields, buildFormData } from "@/lib/utils/field-mapping";
import { buildFileName } from "@/lib/utils/file-name-builder";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "public/uploads";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

/**
 * 获取所有主数据表列表
 */
export async function listDataTables(): Promise<
  ServiceResult<{ id: string; name: string; description: string | null }[]>
> {
  try {
    const tables = await db.dataTable.findMany({
      select: { id: true, name: true, description: true },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: tables };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取主数据表失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

/**
 * 获取主数据表的字段列表
 */
export async function getDataTableFields(dataTableId: string): Promise<
  ServiceResult<{ key: string; label: string; type: string; required: boolean }[]>
> {
  try {
    const fields = await db.dataField.findMany({
      where: { tableId: dataTableId },
      select: { key: true, label: true, type: true, required: true },
      orderBy: { sortOrder: "asc" },
    });
    return { success: true, data: fields };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取字段列表失败";
    return { success: false, error: { code: "FIELDS_FAILED", message } };
  }
}

/**
 * 获取主数据记录列表（带分页和搜索）
 */
export async function listDataRecords(
  dataTableId: string,
  filters: { page: number; pageSize: number; search?: string }
): Promise<
  ServiceResult<{
    items: { id: string; data: Record<string, unknown> }[];
    total: number;
  }>
> {
  try {
    const where: Record<string, unknown> = { tableId: dataTableId };

    // Note: 简单搜索实现，后续可优化为全文搜索
    // 目前不支持搜索，仅分页

    const [items, total] = await Promise.all([
      db.dataRecord.findMany({
        where,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        orderBy: { createdAt: "desc" },
        select: { id: true, data: true },
      }),
      db.dataRecord.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: items.map((item) => ({
          id: item.id,
          data: item.data as Record<string, unknown>,
        })),
        total,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取数据记录失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

/**
 * 获取模板占位符和自动映射
 */
export async function getFieldMappingInfo(
  templateId: string,
  dataTableId: string
): Promise<
  ServiceResult<{
    placeholders: { key: string; label: string; required: boolean }[];
    dataFields: { key: string; label: string }[];
    autoMapping: FieldMapping;
  }>
> {
  try {
    const [template, dataFields] = await Promise.all([
      db.template.findUnique({
        where: { id: templateId },
        include: {
          placeholders: {
            select: { key: true, label: true, required: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      }),
      db.dataField.findMany({
        where: { tableId: dataTableId },
        select: { key: true, label: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    if (!template) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "模板不存在" },
      };
    }

    const placeholders = template.placeholders;
    const autoMapping = autoMatchFields(placeholders, dataFields);

    return {
      success: true,
      data: {
        placeholders,
        dataFields,
        autoMapping,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取映射信息失败";
    return { success: false, error: { code: "MAPPING_FAILED", message } };
  }
}

/**
 * 执行批量生成
 */
export async function generateBatch(
  userId: string,
  input: BatchGenerationInput
): Promise<ServiceResult<BatchGenerationResult>> {
  const { templateId, dataTableId, recordIds, fieldMapping, fileNamePattern, outputMethod } =
    input;

  try {
    // 1. 获取模板和数据表
    const template = await db.template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "模板不存在" },
      };
    }

    const dataTable = await db.dataTable.findUnique({
      where: { id: dataTableId },
    });

    if (!dataTable) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "主数据表不存在" },
      };
    }

    // 2. 获取数据记录
    const records = await db.dataRecord.findMany({
      where: {
        id: { in: recordIds },
        tableId: dataTableId,
      },
    });

    // 3. 创建批次记录
    const batch = await db.batchGeneration.create({
      data: {
        templateId,
        dataTableId,
        totalCount: recordIds.length,
        status: BatchStatus.PROCESSING,
        fileNamePattern,
        outputMethod,
        createdById: userId,
      },
    });

    // 4. 逐条生成文档
    const results: { id: string; fileName: string; dataRecordId: string }[] = [];
    const errors: { recordId: string; error: string }[] = [];
    const generatedFiles: { path: string; name: string }[] = [];

    const targetDir = join(process.cwd(), UPLOAD_DIR, "documents");
    if (!existsSync(targetDir)) await mkdir(targetDir, { recursive: true });

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const recordData = record.data as Record<string, unknown>;

      try {
        // 构建表单数据
        const formData = buildFormData(fieldMapping, recordData);

        // 生成文件名
        const fileName = buildFileName(fileNamePattern, recordData, i + 1);
        const filePath = join(targetDir, fileName);

        // 调用 Python 服务生成文档
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);

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
            throw new Error(
              (errorData as { detail?: string })?.detail ||
                `Python 服务返回错误: ${response.status}`
            );
          }

          // 保存生成的文件
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          await writeFile(filePath, buffer);

          // 创建生成记录
          const genRecord = await db.record.create({
            data: {
              templateId,
              userId,
              formData,
              status: RecordStatus.COMPLETED,
              fileName,
              filePath,
              dataRecordId: record.id,
            },
          });

          results.push({
            id: genRecord.id,
            fileName,
            dataRecordId: record.id,
          });

          generatedFiles.push({ path: filePath, name: fileName });
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "未知错误";
        errors.push({
          recordId: record.id,
          error: errorMessage,
        });
      }
    }

    // 5. 更新批次状态
    await db.batchGeneration.update({
      where: { id: batch.id },
      data: {
        successCount: results.length,
        failedCount: errors.length,
        status: BatchStatus.COMPLETED,
      },
    });

    // 6. 处理输出
    if (outputMethod === "DOWNLOAD" && generatedFiles.length > 0) {
      const zipPath = await createZipArchive(batch.id, generatedFiles);
      return {
        success: true,
        data: {
          success: true,
          batchId: batch.id,
          generatedRecords: results,
          errors: errors.length > 0 ? errors : undefined,
          downloadUrl: `/api/batch/${batch.id}/download`,
        },
      };
    }

    return {
      success: true,
      data: {
        success: true,
        batchId: batch.id,
        generatedRecords: results,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "批量生成失败";
    return { success: false, error: { code: "GENERATE_FAILED", message } };
  }
}

/**
 * 创建 ZIP 压缩包
 */
async function createZipArchive(
  batchId: string,
  files: { path: string; name: string }[]
): Promise<string> {
  const zipDir = join(process.cwd(), UPLOAD_DIR, "batches");
  if (!existsSync(zipDir)) await mkdir(zipDir, { recursive: true });

  const zipPath = join(zipDir, `batch-${batchId}.zip`);

  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve(zipPath));
    archive.on("error", (err) => reject(err));

    archive.pipe(output);

    for (const file of files) {
      if (existsSync(file.path)) {
        archive.file(file.path, { name: file.name });
      }
    }

    archive.finalize();
  });
}

/**
 * 获取批次详情
 */
export async function getBatch(batchId: string): Promise<ServiceResult<BatchGenerationItem>> {
  try {
    const batch = await db.batchGeneration.findUnique({
      where: { id: batchId },
      include: {
        createdBy: { select: { name: true } },
      },
    });

    if (!batch) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "批次不存在" },
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
        outputMethod: batch.outputMethod as "DOWNLOAD" | "SAVE_TO_RECORDS",
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
        createdByName: batch.createdBy.name,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取批次失败";
    return { success: false, error: { code: "GET_FAILED", message } };
  }
}
```

- [ ] **Step 2: 安装 archiver 依赖**

```bash
npm install archiver
npm install -D @types/archiver
```

Expected: 安装成功

- [ ] **Step 3: 提交批量生成服务**

```bash
git add src/lib/services/batch-generation.service.ts package.json package-lock.json
git commit -m "feat(service): add batch generation service"
```

---

## Task 7: 创建批量生成 API 路由

**Files:**
- Create: `src/app/api/templates/[id]/batch/route.ts`
- Create: `src/app/api/batch/[id]/route.ts`
- Create: `src/app/api/batch/[id]/download/route.ts`

- [ ] **Step 1: 创建 POST 批量生成 API**

```typescript
// src/app/api/templates/[id]/batch/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateBatch } from "@/lib/services/batch-generation.service";
import { batchGenerationInputSchema } from "@/validators/batch-generation";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id: templateId } = await params;

  // 检查权限: ADMIN 或模板创建者
  const template = await db.template.findUnique({
    where: { id: templateId },
    select: { createdById: true, status: true },
  });

  if (!template) {
    return NextResponse.json({ error: "模板不存在" }, { status: 404 });
  }

  const isAdmin = (session.user.role as Role) === "ADMIN";
  const isOwner = template.createdById === session.user.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  if (template.status !== "READY") {
    return NextResponse.json({ error: "模板未就绪" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const validated = batchGenerationInputSchema.parse({
      ...body,
      templateId,
    });

    const result = await generateBatch(session.user.id, validated);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "数据验证失败", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "批量生成失败" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 创建 GET 批次状态 API**

```typescript
// src/app/api/batch/[id]/route.ts

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBatch } from "@/lib/services/batch-generation.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;

  const result = await getBatch(id);

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(result.data);
}
```

- [ ] **Step 3: 创建 GET 下载 ZIP API**

```typescript
// src/app/api/batch/[id]/download/route.ts

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBatch } from "@/lib/services/batch-generation.service";
import { existsSync } from "fs";
import { readFile } from "fs/promises";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;

  const result = await getBatch(id);

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  const batch = result.data;

  if (batch.outputMethod !== "DOWNLOAD") {
    return NextResponse.json(
      { error: "此批次不支持下载" },
      { status: 400 }
    );
  }

  const UPLOAD_DIR = process.env.UPLOAD_DIR || "public/uploads";
  const zipPath = `${UPLOAD_DIR}/batches/batch-${id}.zip`;

  if (!existsSync(zipPath)) {
    return NextResponse.json({ error: "ZIP 文件不存在" }, { status: 404 });
  }

  const fileBuffer = await readFile(zipPath);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="batch-${id}.zip"`,
    },
  });
}
```

- [ ] **Step 4: 提交 API 路由**

```bash
git add src/app/api/templates/\[id\]/batch/route.ts src/app/api/batch/
git commit -m "feat(api): add batch generation API routes"
```

---

## Task 8: 创建步骤组件

**Files:**
- Create: `src/components/batch/step-indicator.tsx`
- Create: `src/components/batch/step-navigation.tsx`
- Create: `src/components/batch/step1-select-data.tsx`
- Create: `src/components/batch/step2-field-mapping.tsx`
- Create: `src/components/batch/step3-settings.tsx`
- Create: `src/components/batch/step4-result.tsx`

- [ ] **Step 1: 创建步骤指示器组件**

```typescript
// src/components/batch/step-indicator.tsx

"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  current: number;
  total: number;
  labels?: string[];
}

const DEFAULT_LABELS = ["选择数据源", "字段映射", "生成设置", "执行结果"];

export function StepIndicator({ current, total, labels = DEFAULT_LABELS }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < current;
        const isCurrent = stepNumber === current;

        return (
          <div key={stepNumber} className="flex items-center">
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
                isCompleted && "bg-primary text-primary-foreground",
                isCurrent && "bg-primary text-primary-foreground",
                !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
              )}
            >
              {isCompleted ? (
                <Check className="h-4 w-4" />
              ) : (
                stepNumber
              )}
            </div>
            <span
              className={cn(
                "ml-2 text-sm hidden sm:inline",
                isCurrent ? "text-foreground font-medium" : "text-muted-foreground"
              )}
            >
              {labels[index]}
            </span>
            {index < total - 1 && (
              <div
                className={cn(
                  "w-8 sm:w-16 h-0.5 mx-2",
                  stepNumber < current ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 创建步骤导航组件**

```typescript
// src/components/batch/step-navigation.tsx

"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface StepNavigationProps {
  current: number;
  total: number;
  canNext: boolean;
  onNext: () => void;
  onPrev: () => void;
  isLoading?: boolean;
  nextLabel?: string;
}

export function StepNavigation({
  current,
  total,
  canNext,
  onNext,
  onPrev,
  isLoading,
  nextLabel,
}: StepNavigationProps) {
  const isLast = current === total;

  return (
    <div className="flex items-center justify-between pt-6 border-t">
      <Button
        variant="outline"
        onClick={onPrev}
        disabled={current === 1 || isLoading}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        上一步
      </Button>

      <Button onClick={onNext} disabled={!canNext || isLoading}>
        {isLoading ? (
          "处理中..."
        ) : (
          <>
            {nextLabel || (isLast ? "完成" : "下一步")}
            <ArrowRight className="h-4 w-4 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: 创建步骤1 - 选择数据源组件**

```typescript
// src/components/batch/step1-select-data.tsx

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface DataTable {
  id: string;
  name: string;
  description: string | null;
}

interface DataRecord {
  id: string;
  data: Record<string, unknown>;
}

interface Step1SelectDataProps {
  dataTableId: string | null;
  selectedIds: string[];
  onDataTableChange: (id: string) => void;
  onSelectionChange: (ids: string[]) => void;
}

export function Step1SelectData({
  dataTableId,
  selectedIds,
  onDataTableChange,
  onSelectionChange,
}: Step1SelectDataProps) {
  const [tables, setTables] = useState<DataTable[]>([]);
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [fields, setFields] = useState<{ key: string; label: string }[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 加载主数据表列表
  useEffect(() => {
    async function loadTables() {
      try {
        const res = await fetch("/api/data-tables");
        if (res.ok) {
          const data = await res.json();
          setTables(data);
        }
      } catch {
        console.error("Failed to load tables");
      } finally {
        setLoadingTables(false);
      }
    }
    loadTables();
  }, []);

  // 加载数据记录和字段
  useEffect(() => {
    if (!dataTableId) {
      setRecords([]);
      setFields([]);
      return;
    }

    async function loadRecords() {
      setLoadingRecords(true);
      try {
        // 加载记录
        const recordsRes = await fetch(
          `/api/data-tables/${dataTableId}/records?page=${page}&pageSize=${pageSize}`
        );
        if (recordsRes.ok) {
          const data = await recordsRes.json();
          setRecords(data.items);
          setTotal(data.total);
        }

        // 加载字段
        const fieldsRes = await fetch(`/api/data-tables/${dataTableId}/fields`);
        if (fieldsRes.ok) {
          const data = await fieldsRes.json();
          setFields(data);
        }
      } catch {
        console.error("Failed to load records");
      } finally {
        setLoadingRecords(false);
      }
    }
    loadRecords();
  }, [dataTableId, page]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(records.map((r) => r.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    }
  };

  const displayFields = fields.slice(0, 4); // 最多显示4列

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>选择主数据表</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTables ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : tables.length === 0 ? (
            <p className="text-muted-foreground">暂无主数据表，请先创建</p>
          ) : (
            <Select
              value={dataTableId || undefined}
              onValueChange={onDataTableChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="请选择主数据表" />
              </SelectTrigger>
              <SelectContent>
                {tables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.name}
                    {table.description && ` - ${table.description}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {dataTableId && (
        <Card>
          <CardHeader>
            <CardTitle>
              选择记录
              {selectedIds.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (已选择 {selectedIds.length} 条)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRecords ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : records.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                该数据表暂无记录
              </p>
            ) : (
              <>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={
                              records.length > 0 &&
                              records.every((r) => selectedIds.includes(r.id))
                            }
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        {displayFields.map((field) => (
                          <TableHead key={field.key}>{field.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.includes(record.id)}
                              onCheckedChange={(checked) =>
                                handleSelectOne(record.id, checked as boolean)
                              }
                            />
                          </TableCell>
                          {displayFields.map((field) => (
                            <TableCell key={field.key}>
                              {String(record.data[field.key] ?? "")}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {total > pageSize && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      共 {total} 条记录
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        上一页
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page * pageSize >= total}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 创建步骤2 - 字段映射组件**

```typescript
// src/components/batch/step2-field-mapping.tsx

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X } from "lucide-react";
import type { FieldMapping } from "@/types/batch-generation";

interface Step2FieldMappingProps {
  templateId: string;
  dataTableId: string;
  mapping: FieldMapping;
  onMappingChange: (mapping: FieldMapping) => void;
}

interface MappingInfo {
  placeholders: { key: string; label: string; required: boolean }[];
  dataFields: { key: string; label: string }[];
  autoMapping: FieldMapping;
}

export function Step2FieldMapping({
  templateId,
  dataTableId,
  mapping,
  onMappingChange,
}: Step2FieldMappingProps) {
  const [info, setInfo] = useState<MappingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMappingInfo() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/templates/${templateId}/batch/mapping?dataTableId=${dataTableId}`
        );
        if (res.ok) {
          const data = await res.json();
          setInfo(data);
          // 初始化时使用自动映射
          if (Object.keys(mapping).length === 0) {
            onMappingChange(data.autoMapping);
          }
        }
      } catch {
        console.error("Failed to load mapping info");
      } finally {
        setLoading(false);
      }
    }
    loadMappingInfo();
  }, [templateId, dataTableId]);

  const handleMappingChange = (placeholderKey: string, dataFieldKey: string | null) => {
    onMappingChange({
      ...mapping,
      [placeholderKey]: dataFieldKey === "__none__" ? null : dataFieldKey,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!info) {
    return (
      <p className="text-muted-foreground text-center py-12">
        加载映射信息失败
      </p>
    );
  }

  const matchedCount = Object.values(mapping).filter((v) => v !== null).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>字段映射配置</span>
            <Badge variant="secondary">
              {matchedCount} / {info.placeholders.length} 已映射
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {info.placeholders.map((ph) => {
              const currentValue = mapping[ph.key];
              const autoMatched = info.autoMapping[ph.key];

              return (
                <div
                  key={ph.key}
                  className="flex items-center gap-4 py-2 border-b last:border-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ph.label}</span>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {ph.key}
                      </code>
                      {ph.required && (
                        <Badge variant="destructive" className="text-xs">
                          必填
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentValue === autoMatched && currentValue !== null && (
                      <Badge variant="outline" className="text-xs">
                        <Check className="h-3 w-3 mr-1" />
                        自动匹配
                      </Badge>
                    )}
                    {currentValue === null && ph.required && (
                      <Badge variant="destructive" className="text-xs">
                        <X className="h-3 w-3 mr-1" />
                        未映射
                      </Badge>
                    )}
                  </div>

                  <Select
                    value={currentValue || "__none__"}
                    onValueChange={(value) =>
                      handleMappingChange(ph.key, value === "__none__" ? null : value)
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="选择数据字段" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">不映射</SelectItem>
                      {info.dataFields.map((df) => (
                        <SelectItem key={df.key} value={df.key}>
                          {df.label} ({df.key})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: 创建步骤3 - 生成设置组件**

```typescript
// src/components/batch/step3-settings.tsx

"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Settings } from "@/types/batch-generation";

interface Step3SettingsProps {
  fileNamePattern: string;
  outputMethod: "DOWNLOAD" | "SAVE_TO_RECORDS";
  onSettingsChange: (settings: Settings) => void;
}

export function Step3Settings({
  fileNamePattern,
  outputMethod,
  onSettingsChange,
}: Step3SettingsProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>文件名规则</CardTitle>
          <CardDescription>
            设置生成文档的文件名格式，支持变量替换
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fileNamePattern">文件名模式</Label>
            <Input
              id="fileNamePattern"
              value={fileNamePattern}
              onChange={(e) =>
                onSettingsChange({
                  fileNamePattern: e.target.value,
                  outputMethod,
                })
              }
              placeholder="例如: {project_name}_合同_{date}"
            />
          </div>

          <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
            <p className="font-medium">支持的变量:</p>
            <ul className="text-muted-foreground space-y-0.5">
              <li>
                <code>{"{字段名}"}</code> - 主数据字段值
              </li>
              <li>
                <code>{"{date}"}</code> - 当前日期 (YYYY-MM-DD)
              </li>
              <li>
                <code>{"{time}"}</code> - 当前时间 (HHmmss)
              </li>
              <li>
                <code>{"{序号}"}</code> - 批量生成序号 (从1开始)
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>输出方式</CardTitle>
          <CardDescription>
            选择批量生成结果的输出方式
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={outputMethod}
            onValueChange={(value) =>
              onSettingsChange({
                fileNamePattern,
                outputMethod: value as "DOWNLOAD" | "SAVE_TO_RECORDS",
              })
            }
          >
            <div className="flex items-start space-x-3 p-3 border rounded-lg mb-2">
              <RadioGroupItem value="DOWNLOAD" id="download" />
              <div className="space-y-1">
                <Label htmlFor="download" className="font-medium cursor-pointer">
                  下载 ZIP 压缩包
                </Label>
                <p className="text-sm text-muted-foreground">
                  将所有生成的文档打包为 ZIP 文件下载
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 border rounded-lg">
              <RadioGroupItem value="SAVE_TO_RECORDS" id="save" />
              <div className="space-y-1">
                <Label htmlFor="save" className="font-medium cursor-pointer">
                  保存到生成记录
                </Label>
                <p className="text-sm text-muted-foreground">
                  将生成的文档保存到「生成记录」中，可随时下载
                </p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: 创建步骤4 - 执行结果组件**

```typescript
// src/components/batch/step4-result.tsx

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, CheckCircle, XCircle, FileText } from "lucide-react";
import type { BatchGenerationResult } from "@/types/batch-generation";

interface Step4ResultProps {
  result: BatchGenerationResult | null;
  onDownload: () => void;
  onClose: () => void;
}

export function Step4Result({ result, onDownload, onClose }: Step4ResultProps) {
  if (!result) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">正在生成...</p>
        </CardContent>
      </Card>
    );
  }

  const successCount = result.generatedRecords?.length || 0;
  const failedCount = result.errors?.length || 0;
  const totalCount = successCount + failedCount;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : (
              <XCircle className="h-6 w-6 text-destructive" />
            )}
            批量生成{result.success ? "完成" : "失败"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{totalCount}</p>
              <p className="text-sm text-muted-foreground">总数量</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{successCount}</p>
              <p className="text-sm text-muted-foreground">成功</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{failedCount}</p>
              <p className="text-sm text-muted-foreground">失败</p>
            </div>
          </div>

          {result.downloadUrl && (
            <Button onClick={onDownload} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              下载 ZIP 文件
            </Button>
          )}
        </CardContent>
      </Card>

      {result.generatedRecords && result.generatedRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              生成的文档
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {result.generatedRecords.map((record, index) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-2 bg-muted rounded"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{index + 1}</Badge>
                    <span className="text-sm truncate">{record.fileName}</span>
                  </div>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {result.errors && result.errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              失败的记录
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {result.errors.map((error, index) => (
                <div
                  key={error.recordId}
                  className="flex items-start gap-2 p-2 bg-red-50 rounded"
                >
                  <Badge variant="destructive">{index + 1}</Badge>
                  <div className="flex-1">
                    <p className="text-sm font-medium">记录 ID: {error.recordId}</p>
                    <p className="text-xs text-muted-foreground">{error.error}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>
          返回模板列表
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: 提交步骤组件**

```bash
git add src/components/batch/
git commit -m "feat(components): add batch generation step components"
```

---

## Task 9: 创建批量生成页面

**Files:**
- Create: `src/app/(dashboard)/templates/[id]/batch/page.tsx`

- [ ] **Step 1: 创建批量生成页面**

```typescript
// src/app/(dashboard)/templates/[id]/batch/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { StepIndicator } from "@/components/batch/step-indicator";
import { StepNavigation } from "@/components/batch/step-navigation";
import { Step1SelectData } from "@/components/batch/step1-select-data";
import { Step2FieldMapping } from "@/components/batch/step2-field-mapping";
import { Step3Settings } from "@/components/batch/step3-settings";
import { Step4Result } from "@/components/batch/step4-result";

import type { FieldMapping, Settings, BatchGenerationResult } from "@/types/batch-generation";

interface BatchGenerationPageProps {
  params: Promise<{ id: string }>;
}

export default function BatchGenerationPage({ params }: BatchGenerationPageProps) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // 向导状态
  const [step, setStep] = useState(1);
  const [dataTableId, setDataTableId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [settings, setSettings] = useState<Settings>({
    fileNamePattern: "{名称}_{date}",
    outputMethod: "DOWNLOAD",
  });
  const [result, setResult] = useState<BatchGenerationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 加载模板信息
  useState(() => {
    async function loadTemplate() {
      const { id } = await params;
      setTemplateId(id);

      const template = await db.template.findUnique({
        where: { id },
        select: { name: true, status: true },
      });

      if (!template || template.status !== "READY") {
        notFound();
      }

      setTemplateName(template.name);
      setLoading(false);
    }
    loadTemplate();
  });

  const canProceed = () => {
    switch (step) {
      case 1:
        return dataTableId !== null && selectedIds.length > 0;
      case 2:
        // 检查所有必填占位符是否有映射（这里简化处理）
        return Object.keys(fieldMapping).length > 0;
      case 3:
        return settings.fileNamePattern.trim().length > 0;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (step === 3) {
      // 执行批量生成
      await executeBatchGeneration();
    } else {
      setStep((s) => s + 1);
    }
  };

  const executeBatchGeneration = async () => {
    if (!templateId || !dataTableId) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/templates/${templateId}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataTableId,
          recordIds: selectedIds,
          fieldMapping,
          fileNamePattern: settings.fileNamePattern,
          outputMethod: settings.outputMethod,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "批量生成失败");
      }

      const data = await res.json();
      setResult(data);
      setStep(4);
      toast.success("批量生成完成");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "批量生成失败";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!result?.downloadUrl) return;

    // 直接打开下载链接
    window.open(result.downloadUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        render={<Link href={`/templates/${templateId}`} />}
      >
        <ArrowLeft className="h-4 w-4" />
        返回模板详情
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          批量生成 — {templateName}
        </h1>
        <p className="text-muted-foreground">
          从主数据表选择记录，批量生成文档
        </p>
      </div>

      {/* Step Indicator */}
      <StepIndicator current={step} total={4} />

      {/* Step Content */}
      <div className="min-h-[400px]">
        {step === 1 && (
          <Step1SelectData
            dataTableId={dataTableId}
            selectedIds={selectedIds}
            onDataTableChange={setDataTableId}
            onSelectionChange={setSelectedIds}
          />
        )}

        {step === 2 && templateId && dataTableId && (
          <Step2FieldMapping
            templateId={templateId}
            dataTableId={dataTableId}
            mapping={fieldMapping}
            onMappingChange={setFieldMapping}
          />
        )}

        {step === 3 && (
          <Step3Settings
            fileNamePattern={settings.fileNamePattern}
            outputMethod={settings.outputMethod}
            onSettingsChange={setSettings}
          />
        )}

        {step === 4 && (
          <Step4Result
            result={result}
            onDownload={handleDownload}
            onClose={() => router.push("/templates")}
          />
        )}
      </div>

      {/* Navigation */}
      {step < 4 && (
        <StepNavigation
          current={step}
          total={4}
          canNext={canProceed()}
          onNext={handleNext}
          onPrev={() => setStep((s) => s - 1)}
          isLoading={submitting}
          nextLabel={step === 3 ? "开始生成" : undefined}
        />
      )}
    </div>
  );
}
```

Wait - this is a client component but it's using `db` directly. This is incorrect for Next.js. Let me fix this to use server components properly.

Actually, the page needs to be a client component because it has state. Let me restructure it to fetch template info via API or use a server component wrapper.

- [ ] **Step 1 (Revised): 创建批量生成页面**

```typescript
// src/app/(dashboard)/templates/[id]/batch/page.tsx

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { BatchGenerationWizard } from "./wizard";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BatchGenerationPage({ params }: PageProps) {
  const { id } = await params;

  const template = await db.template.findUnique({
    where: { id },
    select: { id: true, name: true, status: true },
  });

  if (!template || template.status !== "READY") {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        render={<Link href={`/templates/${id}`} />}
      >
        <ArrowLeft className="h-4 w-4" />
        返回模板详情
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          批量生成 — {template.name}
        </h1>
        <p className="text-muted-foreground">
          从主数据表选择记录，批量生成文档
        </p>
      </div>

      {/* Wizard */}
      <BatchGenerationWizard templateId={id} />
    </div>
  );
}
```

- [ ] **Step 2: 创建向导组件**

```typescript
// src/app/(dashboard)/templates/[id]/batch/wizard.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { StepIndicator } from "@/components/batch/step-indicator";
import { StepNavigation } from "@/components/batch/step-navigation";
import { Step1SelectData } from "@/components/batch/step1-select-data";
import { Step2FieldMapping } from "@/components/batch/step2-field-mapping";
import { Step3Settings } from "@/components/batch/step3-settings";
import { Step4Result } from "@/components/batch/step4-result";

import type { FieldMapping, Settings, BatchGenerationResult } from "@/types/batch-generation";

interface BatchGenerationWizardProps {
  templateId: string;
}

export function BatchGenerationWizard({ templateId }: BatchGenerationWizardProps) {
  const router = useRouter();

  // 向导状态
  const [step, setStep] = useState(1);
  const [dataTableId, setDataTableId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [settings, setSettings] = useState<Settings>({
    fileNamePattern: "{名称}_{date}",
    outputMethod: "DOWNLOAD",
  });
  const [result, setResult] = useState<BatchGenerationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canProceed = () => {
    switch (step) {
      case 1:
        return dataTableId !== null && selectedIds.length > 0;
      case 2:
        return Object.keys(fieldMapping).length > 0;
      case 3:
        return settings.fileNamePattern.trim().length > 0;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (step === 3) {
      await executeBatchGeneration();
    } else {
      setStep((s) => s + 1);
    }
  };

  const executeBatchGeneration = async () => {
    if (!dataTableId) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/templates/${templateId}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataTableId,
          recordIds: selectedIds,
          fieldMapping,
          fileNamePattern: settings.fileNamePattern,
          outputMethod: settings.outputMethod,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "批量生成失败");
      }

      const data = await res.json();
      setResult(data);
      setStep(4);
      toast.success("批量生成完成");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "批量生成失败";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!result?.downloadUrl) return;
    window.open(result.downloadUrl, "_blank");
  };

  return (
    <>
      {/* Step Indicator */}
      <StepIndicator current={step} total={4} />

      {/* Step Content */}
      <div className="min-h-[400px]">
        {step === 1 && (
          <Step1SelectData
            dataTableId={dataTableId}
            selectedIds={selectedIds}
            onDataTableChange={setDataTableId}
            onSelectionChange={setSelectedIds}
          />
        )}

        {step === 2 && dataTableId && (
          <Step2FieldMapping
            templateId={templateId}
            dataTableId={dataTableId}
            mapping={fieldMapping}
            onMappingChange={setFieldMapping}
          />
        )}

        {step === 3 && (
          <Step3Settings
            fileNamePattern={settings.fileNamePattern}
            outputMethod={settings.outputMethod}
            onSettingsChange={setSettings}
          />
        )}

        {step === 4 && (
          <Step4Result
            result={result}
            onDownload={handleDownload}
            onClose={() => router.push("/templates")}
          />
        )}
      </div>

      {/* Navigation */}
      {step < 4 && (
        <StepNavigation
          current={step}
          total={4}
          canNext={canProceed()}
          onNext={handleNext}
          onPrev={() => setStep((s) => s - 1)}
          isLoading={submitting}
          nextLabel={step === 3 ? "开始生成" : undefined}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: 添加字段映射 API**

步骤2组件需要一个额外的 API 来获取映射信息。在 `src/app/api/templates/[id]/batch/` 目录创建 `mapping/route.ts`:

```typescript
// src/app/api/templates/[id]/batch/mapping/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFieldMappingInfo } from "@/lib/services/batch-generation.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id: templateId } = await params;
  const { searchParams } = new URL(request.url);
  const dataTableId = searchParams.get("dataTableId");

  if (!dataTableId) {
    return NextResponse.json({ error: "缺少 dataTableId 参数" }, { status: 400 });
  }

  const result = await getFieldMappingInfo(templateId, dataTableId);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(result.data);
}
```

- [ ] **Step 4: 提交批量生成页面**

```bash
git add "src/app/(dashboard)/templates/[id]/batch/" "src/app/api/templates/[id]/batch/mapping/"
git commit -m "feat(page): add batch generation wizard page"
```

---

## Task 10: 添加模板详情页入口按钮

**Files:**
- Modify: `src/app/(dashboard)/templates/[id]/page.tsx`

- [ ] **Step 1: 在模板详情页添加批量生成按钮**

在 `src/app/(dashboard)/templates/[id]/page.tsx` 中，找到"填写表单"按钮的位置（约第128-135行），在它前面添加"批量生成"按钮：

```tsx
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              render={<Link href={`/templates/${template.id}/configure`} />}
            >
              <Settings className="h-4 w-4" />
              配置占位符
            </Button>
          )}
          {(isAdmin || template.status === "READY") && (
            <>
              <Button
                variant="outline"
                render={<Link href={`/templates/${template.id}/batch`} />}
              >
                <Files className="h-4 w-4" />
                批量生成
              </Button>
              <Button
                render={<Link href={`/templates/${template.id}/fill`} />}
              >
                <PenLine className="h-4 w-4" />
                填写表单
              </Button>
            </>
          )}
        </div>
```

- [ ] **Step 2: 添加 Files 图标导入**

在文件顶部的 lucide-react 导入中添加 `Files`:

```tsx
import {
  ArrowLeft,
  Settings,
  Pencil,
  Trash2,
  FileText,
  PenLine,
  CalendarDays,
  User,
  HardDrive,
  Files,  // 添加这个
} from "lucide-react";
```

- [ ] **Step 3: 提交入口按钮变更**

```bash
git add "src/app/(dashboard)/templates/[id]/page.tsx"
git commit -m "feat(ui): add batch generation button to template detail page"
```

---

## Task 11: 浏览器测试验证

**Files:**
- N/A

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 使用 Playwright 浏览器测试**

1. 登录系统 (admin@example.com / admin123)
2. 进入模板详情页，确认"批量生成"按钮显示
3. 点击"批量生成"进入向导页面
4. 步骤1: 选择主数据表，勾选记录
5. 步骤2: 确认字段映射
6. 步骤3: 设置文件名规则和输出方式
7. 步骤4: 执行生成，查看结果

- [ ] **Step 3: 验收标准**

- [ ] 批量生成按钮正确显示在模板详情页
- [ ] 4步向导流程正常工作
- [ ] 字段自动匹配功能正常
- [ ] 批量生成成功创建文档
- [ ] ZIP 下载功能正常
- [ ] 生成记录关联主数据

---

## Summary

完成以上任务后，批量生成功能将包含：

1. **数据库层**: BatchGeneration 模型 + Template/Record 关联
2. **服务层**: 批量生成服务 + 字段映射 + 文件名生成
3. **API 层**: 批量生成 + 批次状态 + ZIP 下载
4. **UI 层**: 4步向导组件 + 模板详情入口

用户可以从模板详情页进入批量生成向导，选择主数据记录，配置字段映射，设置文件名规则，然后批量生成文档。
