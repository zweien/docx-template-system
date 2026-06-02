import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import * as nocodb from "@/lib/nocodb";
import type {
  AutomationDefinition,
  AutomationDetail,
  AutomationItem,
  AutomationRunStatus,
  AutomationTriggerSource,
  AutomationTriggerType,
} from "@/types/automation";
import type { ServiceResult } from "@/types/data-table";
import type {
  CreateAutomationInput,
  UpdateAutomationInput,
} from "@/validators/automation";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function mapAutomationItem(row: {
  id: string;
  tableId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  triggerType: string;
  definitionVersion: number;
  createdById: string;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  tableName?: string | null;
  runs?: Array<{
    id: string;
    status: string;
    triggerSource: string;
    createdAt: Date;
    finishedAt: Date | null;
    durationMs: number | null;
    errorMessage: string | null;
  }>;
}): AutomationItem {
  const latestRun = row.runs?.[0] ?? null;

  return {
    id: row.id,
    tableId: row.tableId,
    tableName: row.tableName ?? null,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    triggerType: row.triggerType as AutomationTriggerType,
    definitionVersion: row.definitionVersion,
    createdById: row.createdById,
    updatedById: row.updatedById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    latestRun: latestRun
      ? {
          id: latestRun.id,
          status: latestRun.status as AutomationRunStatus,
          triggerSource: latestRun.triggerSource as AutomationTriggerSource,
          createdAt: latestRun.createdAt,
          finishedAt: latestRun.finishedAt,
          durationMs: latestRun.durationMs,
          errorMessage: latestRun.errorMessage,
        }
      : null,
  };
}

function mapAutomationDetail(row: Parameters<typeof mapAutomationItem>[0] & {
  definition: unknown;
}): AutomationDetail {
  return {
    ...mapAutomationItem(row),
    definition: row.definition as AutomationDefinition,
  };
}

function validateDefinitionTopology(definition: AutomationDefinition): string | null {
  const triggerNodes = definition.canvas.nodes.filter((node) => node.type === "trigger");
  const conditionNodes = definition.canvas.nodes.filter((node) => node.type === "condition");

  if (triggerNodes.length !== 1) return "必须且只能存在一个触发器节点";
  if (conditionNodes.length > 1) return "第一期仅支持一个条件节点";

  const nodeIds = new Set(definition.canvas.nodes.map((node) => node.id));
  for (const edge of definition.canvas.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      return "存在引用未知节点的连线";
    }
  }

  const duplicateThen =
    definition.canvas.edges.filter((edge) => edge.handle === "then").length >
    definition.thenActions.length;
  if (duplicateThen) return "Then 分支拓扑无效";

  const duplicateElse =
    definition.canvas.edges.filter((edge) => edge.handle === "else").length >
    definition.elseActions.length;
  if (duplicateElse) return "Else 分支拓扑无效";

  return null;
}

// Helper to resolve table names from NocoDB
async function resolveTableNames(tableIds: string[]): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  try {
    const tables = await nocodb.listTables();
    for (const t of tables) {
      nameMap.set(t.id, t.name);
    }
  } catch {
    // If NocoDB is unavailable, fall back to showing IDs
  }
  return nameMap;
}

export async function listAutomations(userId: string): Promise<ServiceResult<AutomationItem[]>> {
  try {
    const rows = await db.automation.findMany({
      where: { createdById: userId },
      include: {
        runs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            triggerSource: true,
            createdAt: true,
            finishedAt: true,
            durationMs: true,
            errorMessage: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    // Resolve table names from NocoDB
    const tableIds = [...new Set(rows.map((r) => r.tableId))];
    const tableNameMap = await resolveTableNames(tableIds);

    return {
      success: true,
      data: rows.map((row) =>
        mapAutomationItem({
          ...row,
          tableName: tableNameMap.get(row.tableId) ?? null,
        })
      ),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取自动化列表失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

export async function getAutomation(
  automationId: string,
  userId: string
): Promise<ServiceResult<AutomationDetail>> {
  try {
    const row = await db.automation.findFirst({
      where: { id: automationId, createdById: userId },
    });
    if (!row) {
      return { success: false, error: { code: "NOT_FOUND", message: "自动化不存在" } };
    }

    const tableNameMap = await resolveTableNames([row.tableId]);
    return {
      success: true,
      data: mapAutomationDetail({
        ...row,
        tableName: tableNameMap.get(row.tableId) ?? null,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取自动化失败";
    return { success: false, error: { code: "GET_FAILED", message } };
  }
}

export async function createAutomation(params: {
  tableId: string;
  userId: string;
  input: CreateAutomationInput;
}): Promise<ServiceResult<AutomationDetail>> {
  const invalidTopology = validateDefinitionTopology(params.input.definition);
  if (invalidTopology) {
    return { success: false, error: { code: "INVALID_DEFINITION", message: invalidTopology } };
  }

  try {
    const created = await db.automation.create({
      data: {
        tableId: params.tableId,
        name: params.input.name,
        description: params.input.description ?? null,
        enabled: params.input.enabled,
        triggerType: params.input.triggerType,
        definitionVersion: 1,
        definition: toJsonValue(params.input.definition),
        createdById: params.userId,
        updatedById: params.userId,
      },
    });

    const tableNameMap = await resolveTableNames([created.tableId]);
    return {
      success: true,
      data: mapAutomationDetail({
        ...created,
        tableName: tableNameMap.get(created.tableId) ?? null,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建自动化失败";
    return { success: false, error: { code: "CREATE_FAILED", message } };
  }
}

export async function updateAutomation(
  automationId: string,
  userId: string,
  input: UpdateAutomationInput
): Promise<ServiceResult<AutomationDetail>> {
  if (input.definition) {
    const invalidTopology = validateDefinitionTopology(input.definition);
    if (invalidTopology) {
      return { success: false, error: { code: "INVALID_DEFINITION", message: invalidTopology } };
    }
  }

  try {
    const existing = await db.automation.findFirst({
      where: { id: automationId, createdById: userId },
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: { code: "NOT_FOUND", message: "自动化不存在" } };
    }

    const updated = await db.automation.update({
      where: { id: automationId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.triggerType !== undefined ? { triggerType: input.triggerType } : {}),
        ...(input.definition !== undefined
          ? {
              definition: toJsonValue(input.definition),
              definitionVersion: 1,
            }
          : {}),
        updatedById: userId,
      },
    });

    const tableNameMap = await resolveTableNames([updated.tableId]);
    return {
      success: true,
      data: mapAutomationDetail({
        ...updated,
        tableName: tableNameMap.get(updated.tableId) ?? null,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新自动化失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}

export async function deleteAutomation(
  automationId: string,
  userId: string
): Promise<ServiceResult<null>> {
  try {
    const result = await db.automation.deleteMany({
      where: { id: automationId, createdById: userId },
    });
    if (result.count === 0) {
      return { success: false, error: { code: "NOT_FOUND", message: "自动化不存在" } };
    }
    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除自动化失败";
    return { success: false, error: { code: "DELETE_FAILED", message } };
  }
}
