import * as nocodb from "@/lib/nocodb";
import type {
  AutomationExecutorParams,
  UpdateRelatedRecordsAction,
} from "@/types/automation";

function collectRelatedRecordIds(
  value: unknown,
  targetScope: UpdateRelatedRecordsAction["targetScope"]
): string[] {
  let recordIds: string[] = [];

  if (typeof value === "string" && value) {
    recordIds = [value];
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    const recordId = (value as { id?: unknown }).id;
    if (typeof recordId === "string" && recordId) {
      recordIds = [recordId];
    }
  } else if (Array.isArray(value)) {
    recordIds = value
      .map((item) =>
        item && typeof item === "object"
          ? (item as { targetRecordId?: unknown }).targetRecordId
          : null
      )
      .filter((item): item is string => typeof item === "string" && item.length > 0);
  }

  if (targetScope === "first") {
    return recordIds.slice(0, 1);
  }

  return recordIds;
}

export async function executeUpdateRelatedRecordsAction(
  params: AutomationExecutorParams<UpdateRelatedRecordsAction>
) {
  if (!params.context.record) {
    return {
      success: false as const,
      error: { code: "RECORD_REQUIRED", message: "当前动作需要记录上下文" },
    };
  }

  // Get table schema from NocoDB
  let tableDetail;
  try {
    tableDetail = await nocodb.getTableDetail(params.context.tableId);
  } catch (error) {
    return {
      success: false as const,
      error: { code: "TABLE_NOT_FOUND", message: "获取表结构失败" },
    };
  }

  const field = tableDetail.fields.find((item) => item.key === params.action.relationFieldKey);
  if (!field) {
    return {
      success: false as const,
      error: {
        code: "RELATION_FIELD_NOT_FOUND",
        message: `字段 "${params.action.relationFieldKey}" 不存在`,
      },
    };
  }

  if (field.type !== "RELATION" && field.type !== "LINK" && field.type !== "RELATION_SUBTABLE") {
    return {
      success: false as const,
      error: {
        code: "RELATION_FIELD_REQUIRED",
        message: `字段 "${params.action.relationFieldKey}" 不是关系字段`,
      },
    };
  }

  const relatedRecordIds = collectRelatedRecordIds(
    params.context.record[params.action.relationFieldKey],
    params.action.targetScope
  );

  if (relatedRecordIds.length === 0) {
    return {
      success: true as const,
      data: {
        relatedTableId: field.relationTargetTableId ?? null,
        updatedCount: 0,
        updatedRecordIds: [],
        noop: true,
      },
    };
  }

  const relatedTableId = field.relationTargetTableId ?? params.context.tableId;
  const updatedRecordIds: string[] = [];

  for (const recordId of relatedRecordIds) {
    try {
      await nocodb.updateRecord(relatedTableId, recordId, params.action.values);
      updatedRecordIds.push(recordId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "更新关联记录失败";
      return {
        success: false as const,
        error: { code: "UPDATE_RELATED_FAILED", message },
      };
    }
  }

  return {
    success: true as const,
    data: {
      relatedTableId,
      updatedCount: updatedRecordIds.length,
      updatedRecordIds,
      noop: false,
    },
  };
}
