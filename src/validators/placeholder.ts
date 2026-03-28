import { z } from "zod";

export const placeholderItemSchema = z.object({
  id: z.string().optional(),
  key: z.string(),
  label: z.string().min(1, "标签不能为空"),
  inputType: z.enum(["TEXT", "TEXTAREA", "TABLE"]),
  required: z.boolean(),
  defaultValue: z.string().nullable(),
  sortOrder: z.number().int().min(0),
  enablePicker: z.boolean().default(false),
  sourceTableId: z.string().nullable().default(null),
  sourceField: z.string().nullable().default(null),
  columns: z.array(z.object({ key: z.string(), label: z.string().min(1) })).nullable().optional(),
  description: z.string().nullable().default(null),
});

export const updatePlaceholdersSchema = z.object({
  placeholders: z.array(placeholderItemSchema).min(1, "至少需要一个占位符"),
});

export const updatePlaceholderSourceSchema = z.object({
  sourceTableId: z.string().nullable(),
  sourceField: z.string().nullable(),
  enablePicker: z.boolean().default(false),
});

export const updatePlaceholderSchema = z.object({
  label: z.string().min(1, "标签不能为空").optional(),
  inputType: z.enum(["TEXT", "TEXTAREA", "TABLE"]).optional(),
  required: z.boolean().optional(),
  defaultValue: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  sourceTableId: z.string().nullable().optional(),
  sourceField: z.string().nullable().optional(),
  enablePicker: z.boolean().optional(),
  columns: z.array(z.object({ key: z.string(), label: z.string().min(1) })).nullable().optional(),
  description: z.string().nullable().optional(),
});

export type UpdatePlaceholderSourceInput = z.infer<typeof updatePlaceholderSourceSchema>;
export type UpdatePlaceholderInput = z.infer<typeof updatePlaceholderSchema>;
