import { z } from "zod";

export const createReportDraftSchema = z.object({
  templateId: z.string().min(1, "请选择报告模板"),
  title: z.string().min(1).max(200).optional(),
});

export const updateReportDraftSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  context: z.record(z.string(), z.string()).optional(),
  sections: z.record(z.string(), z.array(z.any())).optional(),
  attachments: z.record(z.string(), z.array(z.any())).optional(),
  sectionEnabled: z.record(z.string(), z.boolean()).optional(),
});
