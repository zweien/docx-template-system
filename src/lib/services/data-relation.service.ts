import type {
  FilterCondition,
  FilterGroup,
  RelationCardinality,
  RelationSubtableValueItem,
  RollupAggregateType,
  ServiceResult,
} from "@/types/data-table";
import { parseFieldOptions } from "@/types/data-table";
import { db } from "@/lib/db";

type RelationFieldRow = {
  id: string;
  tableId: string;
  key: string;
  type: string;
  options: unknown;
  relationTo: string | null;
  displayField: string | null;
  relationCardinality: RelationCardinality | null;
  inverseFieldId: string | null;
  isSystemManagedInverse: boolean;
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
  $queryRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
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
  }) as Promise<RelationFieldRow[]>;
}

function assertPayloadKeysAreKnownRelationFields(
  relationPayload: Record<
    string,
    RelationSubtableValueItem[] | RelationSubtableValueItem | null
  >,
  relationFields: RelationFieldRow[]
): void {
  const knownKeys = new Set(relationFields.map((field) => field.key));
  for (const payloadKey of Object.keys(relationPayload)) {
    if (!knownKeys.has(payloadKey)) {
      throw new RelationServiceError(
        "INVALID_RELATION_FIELD_KEY",
        `字段 "${payloadKey}" 不是当前表的关系子表格字段`
      );
    }
  }
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
  if (items.length === 0) return;

  if (field.isSystemManagedInverse) {
    // Inverse field editing: check if the FORWARD field's SINGLE cardinality is violated.
    // Each target the user picks (a forward-side record) can only be source for one relation row.
    if (field.inverseField?.relationCardinality !== "SINGLE") return;

    const forwardFieldId = field.inverseFieldId;
    if (!forwardFieldId) return;

    const occupiedRows = await tx.dataRelationRow.findMany({
      where: {
        fieldId: forwardFieldId,
        sourceRecordId: { in: items.map((item) => item.targetRecordId) },
        NOT: { targetRecordId: sourceRecordId },
      },
    });

    if (occupiedRows.length > 0) {
      throw new RelationServiceError(
        "INVERSE_RELATION_CARDINALITY_VIOLATION",
        `字段 "${field.key}" 的正向单值关系已被其它记录占用`
      );
    }
  } else {
    // Forward field editing: check if the INVERSE field's SINGLE cardinality is violated.
    if (field.inverseField?.relationCardinality !== "SINGLE") return;

    const occupiedRows = await tx.dataRelationRow.findMany({
      where: {
        fieldId: field.id,
        targetRecordId: { in: items.map((item) => item.targetRecordId) },
        NOT: { sourceRecordId },
      },
    });

    if (occupiedRows.length > 0) {
      throw new RelationServiceError(
        "INVERSE_RELATION_CARDINALITY_VIOLATION",
        `字段 "${field.key}" 的对端单值关系已被其它记录占用`
      );
    }
  }
}

async function lockRelationRecords(
  tx: RelationTxClient,
  recordIds: Iterable<string>
): Promise<void> {
  const sortedRecordIds = [...new Set(recordIds)].sort((left, right) => left.localeCompare(right));
  if (sortedRecordIds.length === 0) {
    return;
  }

  // 固定排序锁行，避免并发写相同关系集合时产生死锁；FOR UPDATE 保证反向 SINGLE 校验与写入串行化。
  await tx.$queryRawUnsafe(
    'SELECT id FROM "DataRecord" WHERE id = ANY($1::text[]) ORDER BY id ASC FOR UPDATE',
    sortedRecordIds
  );
}

// ─── Rollup condition filtering ──────────────────────────────────────────

function evaluateFilterCondition(
  recordData: Record<string, unknown>,
  condition: FilterCondition
): boolean {
  const raw = recordData[condition.fieldKey];
  switch (condition.op) {
    case "eq":
      return String(raw ?? "") === String(condition.value);
    case "ne":
      return String(raw ?? "") !== String(condition.value);
    case "contains":
      return String(raw ?? "").includes(String(condition.value));
    case "notcontains":
      return !String(raw ?? "").includes(String(condition.value));
    case "startswith":
      return String(raw ?? "").startsWith(String(condition.value));
    case "endswith":
      return String(raw ?? "").endsWith(String(condition.value));
    case "isempty":
      return raw === undefined || raw === null || raw === "";
    case "isnotempty":
      return raw !== undefined && raw !== null && raw !== "";
    case "gt":
      return Number(raw) > Number(condition.value);
    case "lt":
      return Number(raw) < Number(condition.value);
    case "gte":
      return Number(raw) >= Number(condition.value);
    case "lte":
      return Number(raw) <= Number(condition.value);
    case "between": {
      const range = condition.value as { min: number | string; max: number | string };
      const num = Number(raw);
      return num >= Number(range.min) && num <= Number(range.max);
    }
    case "in": {
      const inValues = Array.isArray(condition.value) ? condition.value : [condition.value];
      return inValues.some((v) => String(raw ?? "") === String(v));
    }
    case "notin": {
      const notInValues = Array.isArray(condition.value) ? condition.value : [condition.value];
      return !notInValues.some((v) => String(raw ?? "") === String(v));
    }
    default:
      return true;
  }
}

function recordMatchesFilterGroups(
  recordData: Record<string, unknown>,
  groups: FilterGroup[] | undefined
): boolean {
  if (!groups || groups.length === 0) return true;
  // Groups are OR-combined; conditions within a group follow group.operator
  return groups.some((group) => {
    if (group.conditions.length === 0) return true;
    return group.operator === "OR"
      ? group.conditions.some((c) => evaluateFilterCondition(recordData, c))
      : group.conditions.every((c) => evaluateFilterCondition(recordData, c));
  });
}

// ─── Rollup aggregation ──────────────────────────────────────────────

function computeRollupAggregate(
  values: unknown[],
  aggregateType: RollupAggregateType
): unknown {
  if (values.length === 0) {
    if (aggregateType === "COUNT" || aggregateType === "COUNTA" ||
        aggregateType === "TRUE_COUNT" || aggregateType === "FALSE_COUNT") {
      return 0;
    }
    return null;
  }

  switch (aggregateType) {
    case "SUM":
      return values.reduce((s: number, v) => s + (Number(v) || 0), 0);
    case "AVG": {
      const nums = values.map(Number).filter((n) => !isNaN(n));
      return nums.length > 0 ? nums.reduce((s, v) => s + v, 0) / nums.length : null;
    }
    case "MIN": {
      const nums = values.map(Number).filter((n) => !isNaN(n));
      return nums.length > 0 ? Math.min(...nums) : null;
    }
    case "MAX": {
      const nums = values.map(Number).filter((n) => !isNaN(n));
      return nums.length > 0 ? Math.max(...nums) : null;
    }
    case "COUNT":
      return values.length;
    case "COUNTA":
      return values.filter((v) => v !== null && v !== undefined && v !== "").length;
    case "ARRAYJOIN":
      return values.map(String).join(", ");
    case "ARRAYUNIQUE":
      return [...new Set(values.map(String))];
    case "TRUE_COUNT":
      return values.filter((v) => v === true || v === 1 || v === "true").length;
    case "FALSE_COUNT":
      return values.filter((v) => v !== true && v !== 1 && v !== "true").length;
  }
}

async function refreshRelationSnapshotsForRecords(
  tx: RelationTxClient,
  recordIds: Iterable<string>
): Promise<void> {
  const affectedRecordIds = [...new Set(recordIds)];
  if (affectedRecordIds.length === 0) {
    return;
  }

  const records = await tx.dataRecord.findMany({
    where: {
      id: {
        in: affectedRecordIds,
      },
    },
  });
  if (records.length === 0) {
    return;
  }

  const tableIds = [...new Set(records.map((record) => record.tableId))];
  const relationFields = await tx.dataField.findMany({
    where: {
      tableId: {
        in: tableIds,
      },
      type: "RELATION_SUBTABLE",
    },
  });

  // Load COUNT fields for count computation
  const countFields = await tx.dataField.findMany({
    where: {
      tableId: { in: tableIds },
      type: "COUNT",
    },
  });

  // Load LOOKUP fields for field value pulling
  const lookupFields = await tx.dataField.findMany({
    where: {
      tableId: { in: tableIds },
      type: "LOOKUP",
    },
  });

  // Load ROLLUP fields for aggregation computation
  const rollupFields = await tx.dataField.findMany({
    where: {
      tableId: { in: tableIds },
      type: "ROLLUP",
    },
  });

  // Load RELATION fields for COUNT/Lookup/Rollup source resolution
  const relationLinkFields = await tx.dataField.findMany({
    where: {
      tableId: { in: tableIds },
      type: "RELATION",
    },
  });

  if (relationFields.length === 0 && countFields.length === 0 && lookupFields.length === 0 && rollupFields.length === 0) {
    return;
  }

  // Build source field lookup (RELATION + RELATION_SUBTABLE) for COUNT resolution
  const sourceFieldById = new Map<string, RelationFieldRow>();
  for (const field of [...relationFields, ...relationLinkFields]) {
    sourceFieldById.set(field.id, field);
  }

  // Group countFields by tableId
  const countFieldsByTableId = new Map<string, RelationFieldRow[]>();
  for (const field of countFields) {
    countFieldsByTableId.set(field.tableId, [
      ...(countFieldsByTableId.get(field.tableId) ?? []),
      field,
    ]);
  }

  // Group lookupFields by tableId
  const lookupFieldsByTableId = new Map<string, RelationFieldRow[]>();
  for (const field of lookupFields) {
    lookupFieldsByTableId.set(field.tableId, [
      ...(lookupFieldsByTableId.get(field.tableId) ?? []),
      field,
    ]);
  }

  // Group rollupFields by tableId
  const rollupFieldsByTableId = new Map<string, RelationFieldRow[]>();
  for (const field of rollupFields) {
    rollupFieldsByTableId.set(field.tableId, [
      ...(rollupFieldsByTableId.get(field.tableId) ?? []),
      field,
    ]);
  }

  const relationFieldById = new Map(relationFields.map((field) => [field.id, field]));
  const relationFieldsByTableId = new Map<string, RelationFieldRow[]>();
  const inverseFieldIds = new Set<string>();
  for (const field of relationFields) {
    relationFieldsByTableId.set(field.tableId, [
      ...(relationFieldsByTableId.get(field.tableId) ?? []),
      field,
    ]);
    inverseFieldIds.add(field.id);
  }

  // Only query relation rows when there are RELATION_SUBTABLE fields
  const relationRows = relationFields.length > 0
    ? await tx.dataRelationRow.findMany({
        where: {
          OR: [
            { sourceRecordId: { in: affectedRecordIds } },
            { targetRecordId: { in: affectedRecordIds } },
          ],
        },
        include: {
          field: true,
        },
      })
    : [];

  const relatedRecordIds = new Set<string>();
  for (const row of relationRows) {
    if (affectedRecordIds.includes(row.sourceRecordId) && relationFieldById.has(row.fieldId)) {
      relatedRecordIds.add(row.targetRecordId);
    }
    if (affectedRecordIds.includes(row.targetRecordId) && row.field?.inverseFieldId && inverseFieldIds.has(row.field.inverseFieldId)) {
      relatedRecordIds.add(row.sourceRecordId);
    }
  }

  // Collect linked record IDs from RELATION fields for LOOKUP/ROLLUP resolution
  if (lookupFields.length > 0 || countFields.length > 0 || rollupFields.length > 0) {
    for (const record of records) {
      const recordData = toRecordData(record.data);
      for (const lookupField of lookupFieldsByTableId.get(record.tableId) ?? []) {
        const opts = parseFieldOptions(lookupField.options);
        if (!opts.lookupSourceFieldId || !opts.lookupTargetFieldKey) continue;
        const sourceField = sourceFieldById.get(opts.lookupSourceFieldId);
        if (sourceField?.type === "RELATION") {
          const linkedId = recordData[sourceField.key];
          if (typeof linkedId === "string" && linkedId) {
            relatedRecordIds.add(linkedId);
          }
        }
      }
      for (const rollupField of rollupFieldsByTableId.get(record.tableId) ?? []) {
        const opts = parseFieldOptions(rollupField.options);
        if (!opts.rollupSourceFieldId || !opts.rollupTargetFieldKey) continue;
        const sourceField = sourceFieldById.get(opts.rollupSourceFieldId);
        if (sourceField?.type === "RELATION") {
          const linkedId = recordData[sourceField.key];
          if (typeof linkedId === "string" && linkedId) {
            relatedRecordIds.add(linkedId);
          }
        }
      }
    }
  }

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

  const snapshotItemsByRecordId = new Map<string, Map<string, RelationSubtableValueItem[]>>();
  for (const record of records) {
    const snapshotItemsByFieldId = new Map<string, RelationSubtableValueItem[]>();
    for (const field of relationFieldsByTableId.get(record.tableId) ?? []) {
      snapshotItemsByFieldId.set(field.id, []);
    }
    snapshotItemsByRecordId.set(record.id, snapshotItemsByFieldId);
  }

  for (const row of relationRows) {
    const field = relationFieldById.get(row.fieldId);
    if (field && snapshotItemsByRecordId.has(row.sourceRecordId)) {
      const relatedData = relatedRecordById.get(row.targetRecordId) ?? {};
      snapshotItemsByRecordId.get(row.sourceRecordId)?.get(field.id)?.push({
        targetRecordId: row.targetRecordId,
        displayValue: field.displayField
          ? String(relatedData[field.displayField] ?? row.targetRecordId)
          : row.targetRecordId,
        attributes: unwrapRelationAttributes(row.attributes),
        sortOrder: row.sortOrder,
      });
    }

    const inverseFieldId = row.field?.inverseFieldId;
    if (!inverseFieldId || !snapshotItemsByRecordId.has(row.targetRecordId)) continue;

    const inverseField = relationFieldById.get(inverseFieldId);
    if (!inverseField) continue;

    const sourceData = relatedRecordById.get(row.sourceRecordId) ?? {};
    snapshotItemsByRecordId.get(row.targetRecordId)?.get(inverseFieldId)?.push({
      targetRecordId: row.sourceRecordId,
      displayValue: inverseField.displayField
        ? String(sourceData[inverseField.displayField] ?? row.sourceRecordId)
        : row.sourceRecordId,
      attributes: unwrapRelationAttributes(row.attributes),
      sortOrder: row.sortOrder,
    });
  }

  for (const record of records) {
    const nextData = toRecordData(record.data);
    const snapshotItemsByFieldId = snapshotItemsByRecordId.get(record.id) ?? new Map();
    for (const field of relationFieldsByTableId.get(record.tableId) ?? []) {
      nextData[field.key] = buildSnapshotValue(
        field,
        snapshotItemsByFieldId.get(field.id) ?? []
      );
    }

    // Compute COUNT field values
    for (const countField of countFieldsByTableId.get(record.tableId) ?? []) {
      const opts = parseFieldOptions(countField.options);
      if (!opts.countSourceFieldId) continue;

      const sourceField = sourceFieldById.get(opts.countSourceFieldId);
      if (!sourceField) continue;

      if (sourceField.type === "RELATION_SUBTABLE") {
        // Count = snapshot array length
        nextData[countField.key] = snapshotItemsByFieldId.get(opts.countSourceFieldId)?.length ?? 0;
      } else if (sourceField.type === "RELATION") {
        // Single-link: 1 if linked, 0 if not
        const sourceValue = nextData[sourceField.key];
        nextData[countField.key] = (sourceValue != null && sourceValue !== "") ? 1 : 0;
      }
    }

    // Compute LOOKUP field values
    for (const lookupField of lookupFieldsByTableId.get(record.tableId) ?? []) {
      const opts = parseFieldOptions(lookupField.options);
      if (!opts.lookupSourceFieldId || !opts.lookupTargetFieldKey) continue;
      const sourceField = sourceFieldById.get(opts.lookupSourceFieldId);
      if (!sourceField) {
        continue;
      }

      if (sourceField.type === "RELATION_SUBTABLE") {
        // Pull target field value from each related record snapshot
        const snapshots: typeof snapshotItemsByFieldId extends Map<string, infer V> ? V : never = snapshotItemsByFieldId.get(opts.lookupSourceFieldId) ?? [];
        const targetKey = opts.lookupTargetFieldKey;
        nextData[lookupField.key] = (snapshots ?? []).map((r: RelationSubtableValueItem) => {
          const recordData = relatedRecordById.get(r.targetRecordId);
          if (recordData && targetKey) return recordData[targetKey as keyof typeof recordData] as unknown;
          return r.attributes?.[targetKey] ?? null;
        });
      } else if (sourceField.type === "RELATION") {
        // Pull target field value from single linked record
        // RELATION field stores the linked record ID directly as a string
        const sourceValue = nextData[sourceField.key];
        const linkedRecordId = (typeof sourceValue === "object" && sourceValue !== null)
          ? (sourceValue as Record<string, unknown>).id as string | undefined
          : typeof sourceValue === "string" && sourceValue
            ? sourceValue
            : undefined;
        if (linkedRecordId) {
          const linkedRecordData = relatedRecordById.get(linkedRecordId);
          nextData[lookupField.key] = linkedRecordData?.[opts.lookupTargetFieldKey] ?? null;
        } else {
          nextData[lookupField.key] = null;
        }
      }
    }

    // Compute ROLLUP field values
    for (const rollupField of rollupFieldsByTableId.get(record.tableId) ?? []) {
      const opts = parseFieldOptions(rollupField.options);
      if (!opts.rollupSourceFieldId || !opts.rollupTargetFieldKey || !opts.rollupAggregateType) continue;
      const sourceField = sourceFieldById.get(opts.rollupSourceFieldId);
      if (!sourceField) continue;

      if (sourceField.type === "RELATION_SUBTABLE") {
        let snapshots = snapshotItemsByFieldId.get(opts.rollupSourceFieldId) ?? [];
        const targetKey = opts.rollupTargetFieldKey;
        const conditions = opts.rollupConditions as FilterGroup[] | undefined;
        // Apply filter conditions before aggregation
        if (conditions && conditions.length > 0) {
          snapshots = snapshots.filter((r: RelationSubtableValueItem) => {
            const recordData = relatedRecordById.get(r.targetRecordId);
            return recordData ? recordMatchesFilterGroups(recordData, conditions) : true;
          });
        }
        const values = snapshots.map((r: RelationSubtableValueItem) => {
          const recordData = relatedRecordById.get(r.targetRecordId);
          if (recordData && targetKey) return recordData[targetKey as keyof typeof recordData] as unknown;
          return r.attributes?.[targetKey] ?? null;
        });
        nextData[rollupField.key] = computeRollupAggregate(values, opts.rollupAggregateType as RollupAggregateType);
      } else if (sourceField.type === "RELATION") {
        const sourceValue = nextData[sourceField.key];
        const linkedRecordId = (typeof sourceValue === "object" && sourceValue !== null)
          ? (sourceValue as Record<string, unknown>).id as string | undefined
          : typeof sourceValue === "string" && sourceValue
            ? sourceValue
            : undefined;
        if (linkedRecordId) {
          const linkedRecordData = relatedRecordById.get(linkedRecordId);
          nextData[rollupField.key] = linkedRecordData?.[opts.rollupTargetFieldKey] ?? null;
        } else {
          nextData[rollupField.key] = null;
        }
      }
    }

    await tx.dataRecord.update({
      where: { id: record.id },
      data: { data: nextData },
    });
  }
}

/**
 * Backfill COUNT field values for all records in a table.
 * Called after a new COUNT field is created.
 */
export async function backfillCountFieldValues(
  tableId: string
): Promise<ServiceResult<null>> {
  const BATCH_SIZE = 500;

  const countFields = await db.dataField.findMany({
    where: { tableId, type: "COUNT" },
  });

  const lookupFields = await db.dataField.findMany({
    where: { tableId, type: "LOOKUP" },
  });

  const rollupFields = await db.dataField.findMany({
    where: { tableId, type: "ROLLUP" },
  });

  if (countFields.length === 0 && lookupFields.length === 0 && rollupFields.length === 0) {
    return { success: true, data: null };
  }

  const totalRecords = await db.dataRecord.count({ where: { tableId } });
  if (totalRecords === 0) {
    return { success: true, data: null };
  }

  // Process in batches to avoid large transactions
  for (let offset = 0; offset < totalRecords; offset += BATCH_SIZE) {
    const records = await db.dataRecord.findMany({
      where: { tableId },
      select: { id: true },
      skip: offset,
      take: BATCH_SIZE,
    });

    const recordIds = records.map((r) => r.id);
    await db.$transaction(async (tx) => {
      await refreshRelationSnapshotsForRecords(asTxClient(tx), recordIds);
    });
  }

  return { success: true, data: null };
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
    assertPayloadKeysAreKnownRelationFields(input.relationPayload, relationFields);

    const relationPayloadByFieldId = new Map<string, NormalizedRelationInput>();
    const lockedRecordIds = new Set<string>([input.sourceRecordId]);

    for (const field of relationFields) {
      const items = normalizeRelationPayload(field, input.relationPayload[field.key]);
      await assertTargetRecordsBelongToRelationTable(tx, field, items);
      relationPayloadByFieldId.set(field.id, { field, items });
      items.forEach((item) => lockedRecordIds.add(item.targetRecordId));
    }

    if (relationPayloadByFieldId.size === 0) {
      return { success: true, data: null };
    }

    await lockRelationRecords(tx, lockedRecordIds);

    // Build per-field "storage perspective" — inverse fields store rows
    // with flipped source/target and use the forward field ID.
    type StoragePerspective = {
      storageFieldId: string;
      storageSourceId: string;        // sourceRecordId in the relation row
      isInverse: boolean;
      oppositeRecordId: (targetId: string) => string;
    };
    const perspectiveByFieldId = new Map<string, StoragePerspective>();

    for (const [fieldId, payload] of relationPayloadByFieldId.entries()) {
      const isInverse = payload.field.isSystemManagedInverse;
      if (isInverse && payload.field.inverseFieldId) {
        // Inverse field: relation rows use forward field ID,
        // and source ↔ target are flipped.
        perspectiveByFieldId.set(fieldId, {
          storageFieldId: payload.field.inverseFieldId,
          storageSourceId: "",   // per-item (the target picked by the user)
          isInverse: true,
          oppositeRecordId: (targetId: string) => targetId,  // target becomes source
        });
      } else {
        perspectiveByFieldId.set(fieldId, {
          storageFieldId: fieldId,
          storageSourceId: input.sourceRecordId,
          isInverse: false,
          oppositeRecordId: () => input.sourceRecordId,
        });
      }
    }

    for (const payload of relationPayloadByFieldId.values()) {
      await assertInverseSingleRelationAvailable(
        tx,
        input.sourceRecordId,
        payload.field,
        payload.items
      );
    }

    // Query existing rows using the storage perspective.
    // For forward fields: { sourceRecordId, fieldId }
    // For inverse fields: { targetRecordId, fieldId=inverseFieldId }
    const existingRows: RelationRow[] = [];
    for (const [fieldId, persp] of perspectiveByFieldId.entries()) {
      const rows = await tx.dataRelationRow.findMany({
        where: persp.isInverse
          ? { targetRecordId: input.sourceRecordId, fieldId: persp.storageFieldId }
          : { sourceRecordId: input.sourceRecordId, fieldId: persp.storageFieldId },
      });
      existingRows.push(...rows);
    }

    // Key existing rows by (storageFieldId, the "other" record id relative to sourceRecordId)
    // For forward: other = targetRecordId
    // For inverse: other = sourceRecordId
    const existingRowsByKey = new Map<string, Map<string, RelationRow>>();
    for (const row of existingRows) {
      const rowsByOtherId = existingRowsByKey.get(row.fieldId) ?? new Map<string, RelationRow>();
      const otherId = row.targetRecordId === input.sourceRecordId
        ? row.sourceRecordId
        : row.targetRecordId;
      rowsByOtherId.set(otherId, row);
      existingRowsByKey.set(row.fieldId, rowsByOtherId);
    }

    const affectedRecordIds = new Set<string>([input.sourceRecordId]);

    for (const [fieldId, payload] of relationPayloadByFieldId.entries()) {
      const persp = perspectiveByFieldId.get(fieldId)!;
      const storageFieldId = persp.storageFieldId;
      const isInverse = persp.isInverse;
      const existingByOtherId = existingRowsByKey.get(storageFieldId) ?? new Map<string, RelationRow>();
      // "otherId" from the payload = targetRecordId the user selected
      const nextByOtherId = new Map(payload.items.map((item) => [item.targetRecordId, item]));

      // Delete rows removed from payload
      for (const [otherId, existingRow] of existingByOtherId.entries()) {
        affectedRecordIds.add(otherId);
        if (!nextByOtherId.has(otherId)) {
          await tx.dataRelationRow.deleteMany({
            where: { id: existingRow.id },
          });
        }
      }

      // Create or update rows
      for (const item of payload.items) {
        affectedRecordIds.add(item.targetRecordId);
        const existingRow = existingByOtherId.get(item.targetRecordId);
        if (!existingRow) {
          await tx.dataRelationRow.create({
            data: {
              fieldId: storageFieldId,
              sourceRecordId: isInverse ? item.targetRecordId : input.sourceRecordId,
              targetRecordId: isInverse ? input.sourceRecordId : item.targetRecordId,
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

    await refreshRelationSnapshotsForRecords(tx, affectedRecordIds);

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

    await refreshRelationSnapshotsForRecords(tx, affectedRecordIds);

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

export async function refreshSnapshotsForTargetRecord(input: {
  tx: unknown;
  recordId: string;
}): Promise<ServiceResult<null>> {
  const tx = asTxClient(input.tx);

  try {
    const incomingRows = await tx.dataRelationRow.findMany({
      where: {
        targetRecordId: input.recordId,
      },
    });

    // Include the target record itself — it may also be a source in other relations,
    // and its snapshots need displayValue refreshes when its scalar fields change.
    const affectedIds = new Set(incomingRows.map((row) => row.sourceRecordId));
    affectedIds.add(input.recordId);

    await refreshRelationSnapshotsForRecords(tx, affectedIds);

    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "刷新目标记录引用快照失败";
    return {
      success: false,
      error: {
        code: "REFRESH_TARGET_SNAPSHOTS_FAILED",
        message,
      },
    };
  }
}

/**
 * Refresh relation snapshots (including COUNT/LOOKUP) for specific source records.
 * Use this after editing a RELATION field on a source record to recompute its computed fields.
 */
export async function refreshSnapshotsForSourceRecords(input: {
  tx: unknown;
  recordIds: string[];
}): Promise<ServiceResult<null>> {
  const tx = asTxClient(input.tx);

  try {
    await refreshRelationSnapshotsForRecords(tx, input.recordIds);
    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "刷新源记录快照失败";
    return {
      success: false,
      error: {
        code: "REFRESH_SOURCE_SNAPSHOTS_FAILED",
        message,
      },
    };
  }
}
