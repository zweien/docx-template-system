import { z } from "zod";

export const placeholderItemSchema = z.object({
  id: z.string().optional(),
  key: z.string(),
  label: z.string().min(1, "标签不能为空"),
  inputType: z.enum(["TEXT", "TEXTAREA"]),
  required: z.boolean(),
  defaultValue: z.string().nullable(),
  sortOrder: z.number().int().min(0),
});

export const updatePlaceholdersSchema = z.object({
  placeholders: z.array(placeholderItemSchema).min(1, "至少需要一个占位符"),
});
