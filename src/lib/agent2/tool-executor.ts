// src/lib/agent2/tool-executor.ts
import * as helpers from "./tool-helpers";
import { importPaper } from "./paper-import-executor";
import { invalidateSchemaCache } from "./tool-helpers";
import { invalidateSyspromptCache } from "./context-builder";
import * as nocodb from "@/lib/nocodb";
import { db } from "@/lib/db";

type ExecuteResult = {
  success: boolean;
  data?: unknown;
  error?: string;
  errorDetails?: { code: string; message: string };
};

export async function executeToolAction(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId: string
): Promise<ExecuteResult> {
  switch (toolName) {
    case "createRecord": {
      const tableId = toolInput.tableId as string;
      try {
        const record = await nocodb.createRecord(
          tableId,
          toolInput.data as Record<string, unknown>
        );
        invalidateSchemaCache(tableId);
        invalidateSyspromptCache();
        return { success: true, data: { id: String(record.id), ...record.data } };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "创建记录失败";
        return { success: false, error: msg, errorDetails: { code: "CREATE_FAILED", message: msg } };
      }
    }

    case "updateRecord": {
      const recordId = toolInput.recordId as string;
      const tableId = toolInput.tableId as string;
      try {
        const record = await nocodb.updateRecord(
          tableId,
          recordId,
          toolInput.data as Record<string, unknown>
        );
        invalidateSchemaCache(tableId);
        invalidateSyspromptCache();
        return { success: true, data: { id: String(record.id), tableId, ...record.data } };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "更新记录失败";
        return { success: false, error: msg, errorDetails: { code: "UPDATE_FAILED", message: msg } };
      }
    }

    case "deleteRecord": {
      const delRecordId = toolInput.recordId as string;
      const tableId = toolInput.tableId as string;
      try {
        await nocodb.deleteRecord(tableId, delRecordId);
        invalidateSchemaCache(tableId);
        invalidateSyspromptCache();
        return { success: true, data: { id: delRecordId } };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "删除记录失败";
        return { success: false, error: msg, errorDetails: { code: "DELETE_FAILED", message: msg } };
      }
    }

    case "generateDocument": {
      const templateId = toolInput.templateId as string;
      const formData = toolInput.formData as Record<string, unknown>;

      const template = await db.template.findUnique({
        where: { id: templateId },
        select: { filePath: true, name: true, status: true },
      });

      if (!template) {
        return { success: false, error: `模板 ${templateId} 不存在` };
      }

      if (template.status !== "PUBLISHED") {
        return { success: false, error: `模板未发布，当前状态: ${template.status}，无法生成文档` };
      }

      const pythonUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:8065";
      let response: Response;
      try {
        response = await fetch(`${pythonUrl}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template_path: template.filePath,
            output_filename: `${template.name}-${Date.now()}.docx`,
            form_data: formData,
          }),
        });
      } catch {
        return { success: false, error: "文档生成服务不可达，请检查服务是否运行" };
      }

      if (!response.ok) {
        return { success: false, error: `文档生成失败：服务返回错误 (${response.status})` };
      }

      const result = await response.json();
      return { success: true, data: result };
    }

    case "batchCreateRecords": {
      const btTableId = toolInput.tableId as string;
      try {
        const records = await nocodb.batchCreateRecords(
          btTableId,
          toolInput.records as Record<string, unknown>[]
        );
        invalidateSchemaCache(btTableId);
        invalidateSyspromptCache();
        return { success: true, data: records };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "批量创建失败";
        return { success: false, error: msg, errorDetails: { code: "BATCH_CREATE_FAILED", message: msg } };
      }
    }

    case "batchUpdateRecords": {
      const buTableId = toolInput.tableId as string;
      const updates = toolInput.updates as Array<{ id: string; data: Record<string, unknown> }>;
      try {
        const results = await Promise.all(
          updates.map((u) => nocodb.updateRecord(buTableId, u.id, u.data))
        );
        invalidateSchemaCache(buTableId);
        invalidateSyspromptCache();
        return { success: true, data: results.map((r) => ({ id: String(r.id) })) };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "批量更新失败";
        return { success: false, error: msg, errorDetails: { code: "BATCH_UPDATE_FAILED", message: msg } };
      }
    }

    case "batchDeleteRecords": {
      const bdTableId = toolInput.tableId as string;
      const recordIds = toolInput.recordIds as string[];
      try {
        await Promise.all(
          recordIds.map((id) => nocodb.deleteRecord(bdTableId, id))
        );
        invalidateSchemaCache(bdTableId);
        invalidateSyspromptCache();
        return { success: true, data: { deletedCount: recordIds.length } };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "批量删除失败";
        return { success: false, error: msg, errorDetails: { code: "BATCH_DELETE_FAILED", message: msg } };
      }
    }

    case "importPaper": {
      const paperData = toolInput.paperData as Parameters<typeof importPaper>[0];
      const authors = toolInput.authors as Parameters<typeof importPaper>[1];
      const result = await importPaper(paperData, authors, userId);
      if (!result.success) {
        return { success: false, error: result.error };
      }
      invalidateSyspromptCache();
      return { success: true, data: result.data };
    }

    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}
