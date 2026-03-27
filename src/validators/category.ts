import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1, "分类名称不能为空").max(50, "分类名称最长50字符"),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
