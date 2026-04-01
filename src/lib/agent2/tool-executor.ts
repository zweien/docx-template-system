// src/lib/agent2/tool-executor.ts
import * as helpers from "./tool-helpers";

type ExecuteResult = {
  success: boolean;
  data?: unknown;
  error?: string;
};

export async function executeToolAction(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId: string
): Promise<ExecuteResult> {
  switch (toolName) {
    case "createRecord": {
      const result = await helpers.createRecord(
        userId,
        toolInput.tableId as string,
        toolInput.data as Record<string, unknown>
      );
      if (!result.success)
        return { success: false, error: result.error.message };
      return { success: true, data: result.data };
    }

    case "updateRecord": {
      const result = await helpers.updateRecord(
        toolInput.recordId as string,
        toolInput.data as Record<string, unknown>
      );
      if (!result.success)
        return { success: false, error: result.error.message };
      return { success: true, data: result.data };
    }

    case "deleteRecord": {
      const result = await helpers.deleteRecord(
        toolInput.recordId as string
      );
      if (!result.success)
        return { success: false, error: result.error.message };
      return { success: true, data: result.data };
    }

    case "generateDocument": {
      // Placeholder: document generation will be implemented later
      return {
        success: false,
        error: "文档生成功能尚未实现",
      };
    }

    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}
