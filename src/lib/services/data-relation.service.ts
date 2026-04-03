import type {
  RelationCardinality,
  RelationSubtableValueItem,
  ServiceResult,
} from "@/types/data-table";

type RelationFieldRow = {
  id: string;
  tableId: string;
  key: string;
  type: string;
  relationTo: string | null;
  displayField: string | null;
  relationCardinality: RelationCardinality | null;
  inverseFieldId: string | null;
  inverseField?: {
    id: string;
    key?: string;
    relationCardinality: RelationCardinality | null;
  } | null;
};

type RelationRecordRow = {
  id: string;
  tableId: string;
  data: unknown;
};

type RelationRow = {
  id: string;
  fieldId: string;
  sourceRecordId: string;
  targetRecordId: string;
  attributes: unknown;
  sortOrder: number;
  field?: RelationFieldRow | null;
};

type RelationTxClient = {
  dataField: {
    findMany(args: Record<string, unknown>): Promise<RelationFieldRow[]>;
    findUnique(args: { where: { id: string } }): Promise<RelationFieldRow | null>;
  };
  dataRecord: {
    findUnique(args: { where: { id: string } }): Promise<RelationRecordRow | null>;
    findMany(args: Record<string, unknown>): Promise<RelationRecordRow[]>;
    update(args: {
      where: { id: string };
      data: { data: Record<string, unknown> };
    }): Promise<RelationRecordRow>;
  };
  dataRelationRow: {
    findMany(args: Record<string, unknown>): Promise<RelationRow[]>;
    create(args: {
      data: {
        fieldId: string;
        sourceRecordId: string;
        targetRecordId: string;
        attributes: Record<string, unknown>;
        sortOrder: number;
      };
    }): Promise<RelationRow>;
    update(args: {
      where: { id: string };
      data: {
        attributes?: Record<string, unknown>;
        sortOrder?: number;
      };
    }): Promise<RelationRow>;
    deleteMany(args: Record<string, unknown>): Promise<{ count: number }>;
  };
};

type NormalizedRelationInput = {
  field: RelationFieldRow;
  items: RelationSubtableValueItem[];
};

class RelationServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "RelationServiceError";
  }
}

function asTxClient(tx: unknown): RelationTxClient {
  return tx as RelationTxClient;
}

function toRecordData(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }

  return {};
}

function toVersionedAttributes(attributes: Record<string, unknown>): Record<string, unknown> {
  return {
    version: 1,
    values: JSON.parse(JSON.stringify(attributes ?? {})),
  };
}

function unwrapRelationAttributes(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const payload = value as { values?: unknown };
  if (payload.values && typeof payload.values === "object" && !Array.isArray(payload.values)) {
    return { ...(payload.values as Record<string, unknown>) };
  }

  return {};
}

function normalizeRelationPayload(
  field: RelationFieldRow,
  value: RelationSubtableValueItem[] | RelationSubtableValueItem | null | undefined
): RelationSubtableValueItem[] {
  const items = value === null || value === undefined
    ? []
    : Array.isArray(value)
      ? value
      : [value];

  if (field.relationCardinality === "SINGLE" && items.length > 1) {
    throw new RelationServiceError(
      "RELATION_CARDINALITY_VIOLATION",
      `字段 "${field.key}" 只允许关联 1 条记录`
    );
  }

  const targetIds = new Set<string>();
  return items.map((item, index) => {
    if (!item || typeof item !== "object" || typeof item.targetRecordId !== "string" || item.targetRecordId === "") {
      throw new RelationServiceError(
        "INVALID_RELATION_PAYLOAD",
        `字段 "${field.key}" 的关系值格式不正确`
      );
    }

    if (targetIds.has(item.targetRecordId)) {
      throw new RelationServiceError(
        "RELATION_DUPLICATE_TARGET",
        `字段 "${field.key}" 存在重复的目标记录`
      );
    }
    targetIds.add(item.targetRecordId);

    return {
      targetRecordId: item.targetRecordId,
      displayValue: item.displayValue,
      attributes: { ...(item.attributes ?? {}) },
      sortOrder: Number.isInteger(item.sortOrder) ? item.sortOrder : index,
    };
  }).sort((left, right) => left.sortOrder - right.sortOrder);
}

function buildSnapshotValue(
  field: RelationFieldRow,
  items: RelationSubtableValueItem[]
): RelationSubtableValueItem[] | RelationSubtableValueItem | null {
  const sortedItems = [...items].sort((left, right) => left.sortOrder - right.sortOrder);
  if (field.relationCardinality === "SINGLE") {
    return sortedItems[0] ?? null;
  }

  return sortedItems;
}

function hasSameRelationRow(
  existingRow: RelationRow,
  nextItem: RelationSubtableValueItem
): boolean {
  return existingRow.sortOrder === nextItem.sortOrder &&
    JSON.stringify(unwrapRelationAttributes(existingRow.attributes)) === JSON.stringify(nextItem.attributes);
}

async function assertSourceRecordBelongsToTable(
  tx: RelationTxClient,
  sourceRecordId: string,
  tableId: string
): Promise<void> {
  const sourceRecord = await tx.dataRecord.findUnique({
    where: { id: sourceRecordId },
  });

  if (!sourceRecord) {
    throw new RelationServiceError("SOURCE_RECORD_NOT_FOUND", "源记录不存在");
  }

  if (sourceRecord.tableId !== tableId) {
    throw new RelationServiceError(
      "INVALID_SOURCE_TABLE",
      "sourceRecordId 必须属于当前 tableId"
    );
  }
}

async function loadRelationFields(
  tx: RelationTxClient,
  tableId: string,
  payloadKeys: string[]
): Promise<RelationFieldRow[]> {
  if (payloadKeys.length === 0) {
    return [];
  }

  return tx.dataField.findMany({
    where: {
      tableId,
      type: "RELATION_SUBTABLE",
      key: { in: payloadKeys },
    },
    include: {
      inverseField: {
        select: {
          id: true,
          key: true,
          relationCardinality: true,
        },
      },
    },
  });
}

async function assertTargetRecordsBelongToRelationTable(
  tx: RelationTxClient,
  field: RelationFieldRow,
  items: RelationSubtableValueItem[]
): Promise<void> {
  if (items.length === 0 || !field.relationTo) {
    return;
  }

  const targetIds = items.map((item) => item.targetRecordId);
  const targetRecords = await tx.dataRecord.findMany({
    where: {
      id: { in: targetIds },
    },
  });
  const tableByRecordId = new Map(targetRecords.map((record) => [record.id, record.tableId]));

  for (const targetId of targetIds) {
    if (tableByRecordId.get(targetId) !== field.relationTo) {
      throw new RelationServiceError(
        "INVALID_TARGET_TABLE",
        `字段 "${field.key}" 的目标记录必须属于表 ${field.relationTo}`
      );
    }
  }
}

async function assertInverseSingleRelationAvailable(
  tx: RelationTxClient,
  sourceRecordId: string,
  field: RelationFieldRow,
  items: RelationSubtableValueItem[]
): Promise<void> {
  if (field.inverseField?.relationCardinality !== "SINGLE" || items.length === 0) {
    return;
  }

  const occupiedRows = await tx.dataRelationRow.findMany({
    where: {
      fieldId: field.id,
      targetRecordId: {
        in: items.map((item) => item.targetRecordId),
      },
      NOT: {
        sourceRecordId,
      },
    },
  });

  if (occupiedRows.length > 0) {
    throw new RelationServiceError(
      "INVERSE_RELATION_CARDINALITY_VIOLATION",
      `字段 "${field.key}" 的对端单值关系已被其它记录占用`
    );
  }
}

async function refreshRecordRelationSnapshots(
  tx: RelationTxClient,
  recordId: string
): Promise<void> {
  const record = await tx.dataRecord.findUnique({
    where: { id: recordId },
  });

  if (!record) {
    return;
  }

  const relationFields = await tx.dataField.findMany({
    where: {
      tableId: record.tableId,
      type: "RELATION_SUBTABLE",
    },
  });

  if (relationFields.length === 0) {
    return;
  }

  const relationFieldById = new Map(relationFields.map((field) => [field.id, field]));
  const inverseFieldIdSet = new Set(relationFields.map((field) => field.id));

  const outgoingRows = await tx.dataRelationRow.findMany({
    where: {
      sourceRecordId: recordId,
      fieldId: {
        in: relationFields.map((field) => field.id),
      },
    },
  });
  const incomingRows = await tx.dataRelationRow.findMany({
    where: {
      targetRecordId: recordId,
    },
    include: {
      field: true,
    },
  });

  const relatedRecordIds = new Set<string>();
  outgoingRows.forEach((row) => relatedRecordIds.add(row.targetRecordId));
  incomingRows.forEach((row) => {
    if (row.field?.inverseFieldId && inverseFieldIdSet.has(row.field.inverseFieldId)) {
      relatedRecordIds.add(row.sourceRecordId);
    }
  });

  const relatedRecords = relatedRecordIds.size > 0
    ? await tx.dataRecord.findMany({
      where: {
        id: {
          in: [...relatedRecordIds],
        },
      },
    })
    : [];
  const relatedRecordById = new Map(
    relatedRecords.map((item) => [item.id, toRecordData(item.data)])
  );

  const snapshotItemsByFieldId = new Map<string, RelationSubtableValueItem[]>();
  for (const field of relationFields) {
    snapshotItemsByFieldId.set(field.id, []);
  }

  for (const row of outgoingRows) {
    const field = relationFieldById.get(row.fieldId);
    if (!field) continue;

    const relatedData = relatedRecordById.get(row.targetRecordId) ?? {};
    snapshotItemsByFieldId.get(field.id)?.push({
      targetRecordId: row.targetRecordId,
      displayValue: field.displayField ? String(relatedData[field.displayField] ?? row.targetRecordId) : row.targetRecordId,
      attributes: unwrapRelationAttributes(row.attributes),
      sortOrder: row.sortOrder,
    });
  }

  for (const row of incomingRows) {
    const inverseFieldId = row.field?.inverseFieldId;
    if (!inverseFieldId || !snapshotItemsByFieldId.has(inverseFieldId)) continue;

    const inverseField = relationFieldById.get(inverseFieldId);
    if (!inverseField) continue;

    const sourceData = relatedRecordById.get(row.sourceRecordId) ?? {};
    snapshotItemsByFieldId.get(inverseFieldId)?.push({
      targetRecordId: row.sourceRecordId,
      displayValue: inverseField.displayField
        ? String(sourceData[inverseField.displayField] ?? row.sourceRecordId)
        : row.sourceRecordId,
      attributes: unwrapRelationAttributes(row.attributes),
      sortOrder: row.sortOrder,
    });
  }

  const nextData = toRecordData(record.data);
  for (const field of relationFields) {
    nextData[field.key] = buildSnapshotValue(
      field,
      snapshotItemsByFieldId.get(field.id) ?? []
    );
  }

  await tx.dataRecord.update({
    where: { id: recordId },
    data: { data: nextData },
  });
}

export async function syncRelationSubtableValues(input: {
  tx: unknown;
  sourceRecordId: string;
  tableId: string;
  relationPayload: Record<
    string,
    RelationSubtableValueItem[] | RelationSubtableValueItem | null
  >;
}): Promise<ServiceResult<null>> {
  const tx = asTxClient(input.tx);

  try {
    await assertSourceRecordBelongsToTable(tx, input.sourceRecordId, input.tableId);

    const relationFields = await loadRelationFields(
      tx,
      input.tableId,
      Object.keys(input.relationPayload)
    );
    const relationPayloadByFieldId = new Map<string, NormalizedRelationInput>();

    for (const field of relationFields) {
      const items = normalizeRelationPayload(field, input.relationPayload[field.key]);
      await assertTargetRecordsBelongToRelationTable(tx, field, items);
      await assertInverseSingleRelationAvailable(tx, input.sourceRecordId, field, items);
      relationPayloadByFieldId.set(field.id, { field, items });
    }

    if (relationPayloadByFieldId.size === 0) {
      return { success: true, data: null };
    }

    const existingRows = await tx.dataRelationRow.findMany({
      where: {
        sourceRecordId: input.sourceRecordId,
        fieldId: {
          in: [...relationPayloadByFieldId.keys()],
        },
      },
    });
    const existingRowsByFieldId = new Map<string, Map<string, RelationRow>>();
    for (const row of existingRows) {
      const rowsByTargetId = existingRowsByFieldId.get(row.fieldId) ?? new Map<string, RelationRow>();
      rowsByTargetId.set(row.targetRecordId, row);
      existingRowsByFieldId.set(row.fieldId, rowsByTargetId);
    }

    const affectedRecordIds = new Set<string>([input.sourceRecordId]);

    for (const [fieldId, payload] of relationPayloadByFieldId.entries()) {
      const existingByTargetId = existingRowsByFieldId.get(fieldId) ?? new Map<string, RelationRow>();
      const nextByTargetId = new Map(payload.items.map((item) => [item.targetRecordId, item]));

      for (const [targetRecordId, existingRow] of existingByTargetId.entries()) {
        affectedRecordIds.add(targetRecordId);
        if (!nextByTargetId.has(targetRecordId)) {
          await tx.dataRelationRow.deleteMany({
            where: {
              fieldId,
              sourceRecordId: input.sourceRecordId,
              targetRecordId,
            },
          });
        }
      }

      for (const item of payload.items) {
        affectedRecordIds.add(item.targetRecordId);
        const existingRow = existingByTargetId.get(item.targetRecordId);
        if (!existingRow) {
          await tx.dataRelationRow.create({
            data: {
              fieldId,
              sourceRecordId: input.sourceRecordId,
              targetRecordId: item.targetRecordId,
              attributes: toVersionedAttributes(item.attributes),
              sortOrder: item.sortOrder,
            },
          });
          continue;
        }

        if (!hasSameRelationRow(existingRow, item)) {
          await tx.dataRelationRow.update({
            where: { id: existingRow.id },
            data: {
              attributes: toVersionedAttributes(item.attributes),
              sortOrder: item.sortOrder,
            },
          });
        }
      }
    }

    for (const recordId of affectedRecordIds) {
      await refreshRecordRelationSnapshots(tx, recordId);
    }

    return { success: true, data: null };
  } catch (error) {
    if (error instanceof RelationServiceError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      };
    }

    const message = error instanceof Error ? error.message : "同步关系子表格失败";
    return {
      success: false,
      error: {
        code: "SYNC_RELATIONS_FAILED",
        message,
      },
    };
  }
}

export async function removeAllRelationsForRecord(input: {
  tx: unknown;
  recordId: string;
}): Promise<ServiceResult<null>> {
  const tx = asTxClient(input.tx);

  try {
    const relationRows = await tx.dataRelationRow.findMany({
      where: {
        OR: [
          { sourceRecordId: input.recordId },
          { targetRecordId: input.recordId },
        ],
      },
    });

    if (relationRows.length === 0) {
      return { success: true, data: null };
    }

    const affectedRecordIds = new Set<string>();
    for (const row of relationRows) {
      if (row.sourceRecordId !== input.recordId) {
        affectedRecordIds.add(row.sourceRecordId);
      }
      if (row.targetRecordId !== input.recordId) {
        affectedRecordIds.add(row.targetRecordId);
      }
    }

    await tx.dataRelationRow.deleteMany({
      where: {
        OR: [
          { sourceRecordId: input.recordId },
          { targetRecordId: input.recordId },
        ],
      },
    });

    for (const recordId of affectedRecordIds) {
      await refreshRecordRelationSnapshots(tx, recordId);
    }

    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "清理记录关系失败";
    return {
      success: false,
      error: {
        code: "REMOVE_RELATIONS_FAILED",
        message,
      },
    };
  }
}
