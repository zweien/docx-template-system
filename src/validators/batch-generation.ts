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
