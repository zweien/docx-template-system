import { z } from "zod";

export const createRecordSchema = z.object({
  templateId: z.string().min(1),
  formData: z.record(z.string(), z.union([
    z.string(),
    z.array(z.record(z.string(), z.string())),
  ])),
});

export const recordQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(20),
  status: z.enum(["PENDING", "COMPLETED", "FAILED"]).optional(),
});
