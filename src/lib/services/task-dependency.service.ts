import { db } from "@/lib/db";
import type { ServiceResult, TaskDependencyItem, TaskDependencyType } from "@/types/data-table";

function mapTaskDependencyItem(row: {
  id: string;
  tableId: string;
  successorRecordId: string;
  predecessorRecordId: string;
  type: TaskDependencyType;
  lagDays: number;
  required: boolean;
  createdAt: Date;
  updatedAt: Date;
}): TaskDependencyItem {
  return {
    id: row.id,
    tableId: row.tableId,
    successorRecordId: row.successorRecordId,
    predecessorRecordId: row.predecessorRecordId,
    type: row.type,
    lagDays: row.lagDays,
    required: row.required,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function validateDependencyRecords(params: {
  tableId: string;
  successorRecordId: string;
  predecessorRecordId: string;
}): Promise<ServiceResult<null>> {
  const { tableId, successorRecordId, predecessorRecordId } = params;

  if (successorRecordId === predecessorRecordId) {
    return {
      success: false,
      error: { code: "SELF_LOOP", message: "不允许自循环依赖" },
    };
  }

  const records = await db.dataRecord.findMany({
    where: {
      id: { in: [successorRecordId, predecessorRecordId] },
    },
    select: {
      id: true,
      tableId: true,
    },
  });

  if (records.length !== 2) {
    return {
      success: false,
      error: { code: "RECORD_NOT_FOUND", message: "依赖记录不存在" },
    };
  }

  if (records.some((record) => record.tableId !== tableId)) {
    return {
      success: false,
      error: { code: "CROSS_TABLE_DEPENDENCY", message: "不允许跨表依赖" },
    };
  }

  return { success: true, data: null };
}

export async function listTaskDependencies(
  tableId: string
): Promise<ServiceResult<TaskDependencyItem[]>> {
  try {
    const rows = await db.taskDependency.findMany({
      where: { tableId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return { success: true, data: rows.map(mapTaskDependencyItem) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取依赖失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

export async function upsertTaskDependency(input: {
  tableId: string;
  successorRecordId: string;
  predecessorRecordId: string;
  type: TaskDependencyType;
  lagDays: number;
  required: boolean;
}): Promise<ServiceResult<TaskDependencyItem>> {
  try {
    if (input.type !== "FS") {
      return {
        success: false,
        error: { code: "INVALID_TYPE", message: "当前仅支持 FS 依赖" },
      };
    }

    const validation = await validateDependencyRecords(input);
    if (!validation.success) {
      return validation;
    }

    const row = await db.taskDependency.upsert({
      where: {
        successorRecordId_predecessorRecordId_type: {
          successorRecordId: input.successorRecordId,
          predecessorRecordId: input.predecessorRecordId,
          type: input.type,
        },
      },
      update: {
        tableId: input.tableId,
        lagDays: input.lagDays,
        required: input.required,
      },
      create: {
        tableId: input.tableId,
        successorRecordId: input.successorRecordId,
        predecessorRecordId: input.predecessorRecordId,
        type: input.type,
        lagDays: input.lagDays,
        required: input.required,
      },
    });

    return { success: true, data: mapTaskDependencyItem(row) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存依赖失败";
    return { success: false, error: { code: "UPSERT_FAILED", message } };
  }
}

export async function deleteTaskDependency(
  tableId: string,
  depId: string
): Promise<ServiceResult<null>> {
  try {
    const result = await db.taskDependency.deleteMany({
      where: {
        id: depId,
        tableId,
      },
    });

    if (result.count === 0) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "依赖不存在" },
      };
    }

    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除依赖失败";
    return { success: false, error: { code: "DELETE_FAILED", message } };
  }
}
