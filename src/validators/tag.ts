import { z } from "zod";

export const createTagSchema = z.object({
  name: z.string().min(1, "标签名称不能为空").max(30, "标签名称最长30字符"),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
