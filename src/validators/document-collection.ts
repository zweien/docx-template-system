import { z } from "zod";
import { DOCUMENT_COLLECTION_RESERVED_VARIABLE_KEYS } from "@/lib/utils/document-collection-file-name";

const renameVariableKeySchema = z
  .string()
  .trim()
  .min(1, "自定义变量名不能为空")
  .refine((value) => !DOCUMENT_COLLECTION_RESERVED_VARIABLE_KEYS.has(value), {
    message: "自定义变量名不能与保留变量重名",
  });

const renameVariablesSchema = z.record(renameVariableKeySchema, z.string().trim().min(1, "变量值不能为空")).default({});

export const createDocumentCollectionTaskSchema = z.object({
  title: z.string().trim().min(1, "请输入任务标题"),
  instruction: z.string().trim().min(1, "请输入提交要求说明"),
  dueAt: z.coerce.date({ message: "请选择截止日期" }),
  assigneeIds: z.array(z.string().trim().min(1, "提交人ID无效")).min(1, "请至少选择一位提交人"),
  renameRule: z.string().trim().min(1, "请输入命名规则"),
  renameVariables: renameVariablesSchema,
});

export const documentCollectionListQuerySchema = z.object({
  scope: z.enum(["created", "assigned", "all"]).optional(),
  status: z.enum(["active", "closed"]).optional(),
  search: z.string().trim().min(1).optional(),
});

export const submitDocumentCollectionNoteSchema = z.object({
  note: z.string().trim().max(1000, "备注不能超过1000个字符").optional(),
});

export type CreateDocumentCollectionTaskInput = z.infer<typeof createDocumentCollectionTaskSchema>;
export type DocumentCollectionListQueryInput = z.infer<typeof documentCollectionListQuerySchema>;
export type SubmitDocumentCollectionNoteInput = z.infer<typeof submitDocumentCollectionNoteSchema>;
