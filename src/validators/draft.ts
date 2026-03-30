import { z } from "zod";

export const saveDraftSchema = z.object({
  templateId: z.string().min(1),
  formData: z.record(z.string(), z.union([
    z.string(),
    z.array(z.string()),
    z.array(z.record(z.string(), z.string())),
  ])),
});
