import { z } from "zod";
import { FieldType } from "@/generated/prisma/enums";

// ========== Field Type Schema ==========

export const fieldTypeSchema = z.nativeEnum(FieldType);

// ========== Field Schemas ==========

export const dataFieldItemSchema = z.object({
  id: z.string().optional(),
  key: z
    .string()
    .min(1, "字段标识不能为空")
    .max(50, "字段标识最长50字符")
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "字段标识必须以小写字母开头，只能包含小写字母、数字和下划线"
    ),
  label: z.string().min(1, "显示名称不能为空").max(100, "显示名称最长100字符"),
  type: fieldTypeSchema,
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  relationTo: z.string().optional(),
  displayField: z.string().optional(),
  defaultValue: z.string().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

// ========== Table Schemas ==========

export const createTableSchema = z.object({
  name: z.string().min(1, "表名不能为空").max(100, "表名最长100字符"),
  description: z.string().max(500, "描述最长500字符").optional(),
  icon: z.string().max(50, "图标最长50字符").optional(),
});

export const updateTableSchema = createTableSchema.partial();

export const updateFieldsSchema = z.object({
  fields: z.array(dataFieldItemSchema).max(50, "单表最多50个字段"),
});

// ========== Record Schemas ==========

export const recordQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export const createRecordSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

export const updateRecordSchema = createRecordSchema;

// ========== Import/Export Schemas ==========

export const fieldMappingSchema = z.record(z.string(), z.string().nullable());

export const importOptionsSchema = z.object({
  uniqueField: z.string(), // 用于判断重复的字段 key
  strategy: z.enum(["skip", "overwrite"]),
});

export const importSchema = z.object({
  mapping: fieldMappingSchema,
  options: importOptionsSchema,
});

// ========== Type Exports ==========

export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
export type UpdateFieldsInput = z.infer<typeof updateFieldsSchema>;
export type DataFieldInput = z.infer<typeof dataFieldItemSchema>;
export type RecordQueryInput = z.infer<typeof recordQuerySchema>;
export type CreateRecordInput = z.infer<typeof createRecordSchema>;
export type UpdateRecordInput = z.infer<typeof updateRecordSchema>;
export type FieldMappingInput = z.infer<typeof fieldMappingSchema>;
export type ImportOptionsInput = z.infer<typeof importOptionsSchema>;
export type ImportInput = z.infer<typeof importSchema>;
