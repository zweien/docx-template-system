import { z } from "zod";

export const createTemplateSchema = z.object({
  name: z.string().min(1, "模板名称不能为空").max(100),
  description: z.string().max(500).optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(["DRAFT", "READY", "ARCHIVED"]).optional(),
});

export const templateQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(20),
  status: z.enum(["DRAFT", "READY", "ARCHIVED"]).optional(),
});
