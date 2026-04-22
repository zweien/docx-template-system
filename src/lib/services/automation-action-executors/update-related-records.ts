import { getTable } from "@/lib/services/data-table.service";
import { updateRecord } from "@/lib/services/data-record.service";
import type { RelationSubtableValueItem } from "@/types/data-table";
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
          ? (item as RelationSubtableValueItem).targetRecordId
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

  const table = await getTable(params.context.tableId);
  if (!table.success) {
    return table;
  }

  const field = table.data.fields.find((item) => item.key === params.action.relationFieldKey);
  if (!field) {
    return {
      success: false as const,
      error: {
        code: "RELATION_FIELD_NOT_FOUND",
        message: `字段 "${params.action.relationFieldKey}" 不存在`,
      },
    };
  }

  if (field.type !== "RELATION" && field.type !== "RELATION_SUBTABLE") {
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
        relatedTableId: field.relationTo ?? null,
        updatedCount: 0,
        updatedRecordIds: [],
        noop: true,
      },
    };
  }

  const actorId = params.context.actor?.id ?? "system";
  const updatedRecordIds: string[] = [];

  for (const recordId of relatedRecordIds) {
    const result = await updateRecord(recordId, params.action.values, actorId);
    if (!result.success) {
      return result;
    }
    updatedRecordIds.push(recordId);
  }

  return {
    success: true as const,
    data: {
      relatedTableId: field.relationTo ?? null,
      updatedCount: updatedRecordIds.length,
      updatedRecordIds,
      noop: false,
    },
  };
}
