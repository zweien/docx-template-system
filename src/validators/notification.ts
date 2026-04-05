import { z } from "zod";

export const markReadSchema = z.object({
  notificationIds: z.array(z.string().min(1)).min(1, "请选择要标记已读的通知"),
});

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type MarkReadInput = z.infer<typeof markReadSchema>;
export type NotificationListQueryInput = z.infer<typeof notificationListQuerySchema>;
