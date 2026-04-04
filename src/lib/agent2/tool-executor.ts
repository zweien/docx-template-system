// src/lib/agent2/tool-executor.ts
import * as helpers from "./tool-helpers";
import * as recordService from "@/lib/services/data-record.service";
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
      const result = await recordService.createRecord(
        userId,
        toolInput.tableId as string,
        toolInput.data as Record<string, unknown>
      );
      if (!result.success)
        return { success: false, error: result.error.message, errorDetails: result.error };
      return { success: true, data: result.data };
    }

    case "updateRecord": {
      const result = await recordService.updateRecord(
        toolInput.recordId as string,
        toolInput.data as Record<string, unknown>
      );
      if (!result.success)
        return { success: false, error: result.error.message, errorDetails: result.error };
      return { success: true, data: result.data };
    }

    case "deleteRecord": {
      const result = await recordService.deleteRecord(
        toolInput.recordId as string
      );
      if (!result.success)
        return { success: false, error: result.error.message, errorDetails: result.error };
      // data-record.service.deleteRecord 返回 null，但下游期望 { id } 格式
      return { success: true, data: { id: toolInput.recordId as string } };
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

    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}
