import { z } from "zod";

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  userId: z.string().optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
