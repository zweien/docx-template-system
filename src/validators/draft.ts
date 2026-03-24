import { z } from "zod";

export const saveDraftSchema = z.object({
  templateId: z.string().min(1),
  formData: z.record(z.string(), z.string()),
});
