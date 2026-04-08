import { db } from "@/lib/db";
import { FieldType, RelationCardinality as PrismaRelationCardinality } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import type { DataFieldInput } from "@/validators/data-table";
import type { ServiceResult } from "@/types/data-table";

type JsonLike = Prisma.InputJsonValue | undefined;

type FieldRow = {
  id: string;
  tableId: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: unknown;
  relationTo: string | null;
  displayField: string | null;
  relationCardinality: string | null;
  inverseFieldId: string | null;
  isSystemManagedInverse: boolean;
  relationSchema: unknown;
  defaultValue: string | null;
  sortOrder: number;
  inverseField: FieldRow | null;
};

class FieldServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "FieldServiceError";
  }
}

function toJsonInput(value: unknown): JsonLike {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function getFieldIdentity(field: DataFieldInput): string {
  return field.id ?? field.key;
}

function isRelationSubtable(field: DataFieldInput): boolean {
  return field.type === "RELATION_SUBTABLE";
}

function resolveInverseRelationCardinality(
  field: DataFieldInput,
  fallback?: PrismaRelationCardinality | null
): PrismaRelationCardinality {
  const explicit = field.inverseRelationCardinality;

  if (field.relationCardinality === "MULTIPLE") {
    if (explicit && explicit !== "MULTIPLE") {
      throw new FieldServiceError(
        "INVALID_INVERSE_RELATION_CARDINALITY",
        `字段 "${field.label}" 的反向关系基数必须是 MULTIPLE`
      );
    }
    return fallback ?? "MULTIPLE";
  }

  return explicit ?? fallback ?? "SINGLE";
}

function validateInputFields(fields: DataFieldInput[]): void {
  const keys = new Set<string>();
  const ids = new Set<string>();

  for (const field of fields) {
    if (keys.has(field.key)) {
      throw new FieldServiceError("DUPLICATE_KEYS", "存在重复的字段标识");
    }
    keys.add(field.key);

    if (field.id) {
      if (ids.has(field.id)) {
        throw new FieldServiceError("DUPLICATE_IDS", "存在重复的字段 ID");
      }
      ids.add(field.id);
    }

    if (!isRelationSubtable(field)) continue;

    if (!field.relationTo) {
      throw new FieldServiceError("MISSING_RELATION_TO", `字段 "${field.label}" 是关系子表格类型，必须指定关联表`);
    }

    if (!field.displayField) {
      throw new FieldServiceError("MISSING_DISPLAY_FIELD", `字段 "${field.label}" 是关系子表格类型，必须指定展示字段`);
    }

    if (!field.relationCardinality) {
      throw new FieldServiceError(
        "MISSING_RELATION_CARDINALITY",
        `字段 "${field.label}" 是关系子表格类型，必须指定关系基数`
      );
    }

    resolveInverseRelationCardinality(field);

    if (field.relationSchema) {
      if (field.relationSchema.version !== 1) {
        throw new FieldServiceError("INVALID_RELATION_SCHEMA", `字段 "${field.label}" 的关系 schema 版本不受支持`);
      }

      const schemaKeys = new Set<string>();
      for (const schemaField of field.relationSchema.fields) {
        if (schemaKeys.has(schemaField.key)) {
          throw new FieldServiceError(
            "INVALID_RELATION_SCHEMA",
            `字段 "${field.label}" 的关系 schema 存在重复的子字段标识`
          );
        }
        schemaKeys.add(schemaField.key);
      }
    }
  }
}

function relationSchemaToJson(schema: DataFieldInput["relationSchema"] | null | undefined): JsonLike {
  return schema ? toJsonInput(schema) : undefined;
}

function isSameRelationSchema(
  left: DataFieldInput["relationSchema"] | null | undefined,
  right: DataFieldInput["relationSchema"] | null | undefined
): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function assertNonDestructiveRelationSchema(
  existingSchema: unknown,
  nextSchema: DataFieldInput["relationSchema"] | null | undefined,
  fieldLabel: string
): void {
  const normalizedExisting = existingSchema ?? null;
  const normalizedNext = nextSchema ?? null;

  if (normalizedExisting === null) {
    return;
  }

  if (normalizedNext === null) {
    throw new FieldServiceError(
      "INVALID_RELATION_SCHEMA",
      `字段 "${fieldLabel}" 不能直接清空已存在的关系 schema`
    );
  }

  if (!isSameRelationSchema(normalizedExisting as DataFieldInput["relationSchema"], normalizedNext)) {
    const existingFields = (normalizedExisting as { fields?: Array<{ key: string; type: string }> }).fields ?? [];
    const nextFields = normalizedNext.fields;
    const nextByKey = new Map(nextFields.map((item) => [item.key, item]));

    for (const existingField of existingFields) {
      const nextField = nextByKey.get(existingField.key);
      if (!nextField) {
        throw new FieldServiceError(
          "INVALID_RELATION_SCHEMA",
          `字段 "${fieldLabel}" 的关系 schema 不能删除已有子字段 "${existingField.key}"`
        );
      }
      if (nextField.type !== existingField.type) {
        throw new FieldServiceError(
          "INVALID_RELATION_SCHEMA",
          `字段 "${fieldLabel}" 的关系 schema 不能修改子字段 "${existingField.key}" 的类型`
        );
      }
    }
  }
}

function buildFieldCreateData(
  tableId: string,
  field: DataFieldInput,
  sortOrderFallback: number
): Prisma.DataFieldUncheckedCreateInput {
  return {
    tableId,
    key: field.key,
    label: field.label,
    type: field.type as FieldType,
    required: field.required ?? false,
    options: toJsonInput(field.options),
    relationTo: field.relationTo ?? null,
    displayField: field.displayField ?? null,
    relationCardinality: field.relationCardinality ?? null,
    inverseFieldId: null,
    isSystemManagedInverse: false,
    relationSchema: relationSchemaToJson(field.relationSchema),
    defaultValue: field.defaultValue ?? null,
    sortOrder: field.sortOrder ?? sortOrderFallback,
  };
}

function buildFieldUpdateData(
  field: DataFieldInput,
  existing: FieldRow,
  nextRelationSchema?: DataFieldInput["relationSchema"] | null
): Prisma.DataFieldUncheckedUpdateInput {
  const updateData: Prisma.DataFieldUncheckedUpdateInput = {
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required ?? false,
    options: toJsonInput(field.options),
    displayField: field.displayField ?? existing.displayField ?? null,
    defaultValue: field.defaultValue ?? null,
    sortOrder: field.sortOrder ?? existing.sortOrder,
  };

  if (field.relationTo !== undefined && field.relationTo !== null) {
    updateData.relationTo = field.relationTo;
  }

  if (field.relationCardinality !== undefined && field.relationCardinality !== null) {
    updateData.relationCardinality = field.relationCardinality;
  }

  if (nextRelationSchema !== undefined) {
    updateData.relationSchema = relationSchemaToJson(nextRelationSchema);
  }

  return updateData;
}

function isJsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function assertLockedRelationFieldInput(existing: FieldRow, next: DataFieldInput): void {
  if (existing.required !== (next.required ?? false)) {
    throw new FieldServiceError("RELATION_FIELD_LOCKED", `字段 "${existing.label}" 的 required 已锁定，不能修改`);
  }

  if (!isJsonEqual(existing.options, next.options)) {
    throw new FieldServiceError("RELATION_FIELD_LOCKED", `字段 "${existing.label}" 的 options 已锁定，不能修改`);
  }

  if ((existing.defaultValue ?? null) !== (next.defaultValue ?? null)) {
    throw new FieldServiceError("RELATION_FIELD_LOCKED", `字段 "${existing.label}" 的 defaultValue 已锁定，不能修改`);
  }

  if (existing.sortOrder !== (next.sortOrder ?? existing.sortOrder)) {
    throw new FieldServiceError("RELATION_FIELD_LOCKED", `字段 "${existing.label}" 的 sortOrder 已锁定，不能修改`);
  }

  if (
    Object.prototype.hasOwnProperty.call(next, "inverseFieldId") &&
    (next.inverseFieldId ?? null) !== (existing.inverseFieldId ?? null)
  ) {
    throw new FieldServiceError("RELATION_FIELD_LOCKED", `字段 "${existing.label}" 的 inverseFieldId 已锁定，不能修改`);
  }

  const existingInverseCardinality = (existing.inverseField?.relationCardinality ?? null) as
    | PrismaRelationCardinality
    | null;
  if (
    existingInverseCardinality !== null &&
    Object.prototype.hasOwnProperty.call(next, "inverseRelationCardinality")
  ) {
    const nextInverseCardinality = resolveInverseRelationCardinality(next, existingInverseCardinality);
    if (nextInverseCardinality !== existingInverseCardinality) {
      throw new FieldServiceError(
        "RELATION_FIELD_LOCKED",
        `字段 "${existing.label}" 的 inverseRelationCardinality 已锁定，不能修改`
      );
    }
  }
}

function buildInverseDefaults(
  field: DataFieldInput,
  sourceTableId: string,
  displayField: string,
  inverseRelationCardinality: PrismaRelationCardinality
): Pick<
  Prisma.DataFieldUncheckedCreateInput,
  "label" | "type" | "required" | "options" | "relationTo" | "displayField" | "relationCardinality" | "isSystemManagedInverse" | "relationSchema" | "defaultValue"
> {
  return {
    label: `${field.label}（反向）`,
    type: "RELATION_SUBTABLE" as FieldType,
    required: field.required ?? false,
    options: toJsonInput(field.options),
    relationTo: sourceTableId,
    displayField,
    relationCardinality: inverseRelationCardinality,
    isSystemManagedInverse: true,
    relationSchema: relationSchemaToJson(field.relationSchema),
    defaultValue: field.defaultValue ?? null,
  };
}

function getDefaultInverseDisplayField(candidateKeys: string[]): string {
  if (candidateKeys.length > 0) {
    return candidateKeys[0];
  }

  return "id";
}

function buildSourceDisplayFieldCandidates(fields: DataFieldInput[]): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  for (const field of fields) {
    if (isRelationSubtable(field)) continue;
    if (seen.has(field.key)) continue;
    seen.add(field.key);
    candidates.push(field.key);
  }

  return candidates;
}

async function loadTableFieldKeys(
  tx: Prisma.TransactionClient,
  tableId: string,
  cache: Map<string, Set<string>>
): Promise<Set<string>> {
  const cached = cache.get(tableId);
  if (cached) return cached;

  const rows = await tx.dataField.findMany({
    where: { tableId },
    select: { key: true },
  });
  const keys = new Set(rows.map((row) => row.key));
  cache.set(tableId, keys);
  return keys;
}

function ensureForwardAndInverseAreCompatible(existing: FieldRow, next: DataFieldInput): void {
  if (existing.type !== (next.type as FieldType)) {
    throw new FieldServiceError("FIELD_TYPE_LOCKED", `字段 "${existing.label}" 的类型已锁定`);
  }

  if (existing.relationTo !== (next.relationTo ?? null)) {
    throw new FieldServiceError("RELATION_TARGET_LOCKED", `字段 "${existing.label}" 的关联目标已锁定`);
  }

  if (existing.relationCardinality !== (next.relationCardinality ?? null)) {
    throw new FieldServiceError("RELATION_CARDINALITY_LOCKED", `字段 "${existing.label}" 的关系基数已锁定`);
  }

  if (existing.inverseFieldId !== null && existing.inverseField && existing.inverseField.id !== existing.inverseFieldId) {
    throw new FieldServiceError("INVERSE_BINDING_BROKEN", `字段 "${existing.label}" 的反向字段绑定已损坏`);
  }
}

async function createInverseFieldPair(
  tx: Prisma.TransactionClient,
  tableKeyCache: Map<string, Set<string>>,
  sourceTableId: string,
  sourceField: DataFieldInput,
  sourceFieldId: string,
  sourceDisplayFieldCandidates: string[],
  inverseRelationCardinality: PrismaRelationCardinality
): Promise<string> {
  if (!sourceField.relationTo) {
    throw new FieldServiceError("MISSING_RELATION_TO", `字段 "${sourceField.label}" 缺少关联表`);
  }

  const targetKeys = await loadTableFieldKeys(tx, sourceField.relationTo, tableKeyCache);
  const inverseBaseKey = `${sourceField.key}_inverse`;
  let inverseKey = inverseBaseKey;
  let suffix = 1;
  while (targetKeys.has(inverseKey)) {
    inverseKey = `${inverseBaseKey}_${suffix}`;
    suffix += 1;
  }
  targetKeys.add(inverseKey);

  const inverse = await tx.dataField.create({
    data: {
      tableId: sourceField.relationTo,
      key: inverseKey,
      ...buildInverseDefaults(
        sourceField,
        sourceTableId,
        getDefaultInverseDisplayField(sourceDisplayFieldCandidates),
        inverseRelationCardinality
      ),
      inverseFieldId: sourceFieldId,
    },
  });

  await tx.dataField.update({
    where: { id: sourceFieldId },
    data: {
      inverseFieldId: inverse.id,
    },
  });

  // 同步反向字段的结构锁定信息，保证两侧成对保存。
  await tx.dataField.update({
    where: { id: inverse.id },
    data: {
      inverseFieldId: sourceFieldId,
      relationSchema: relationSchemaToJson(sourceField.relationSchema),
    },
  });

  return inverse.id;
}

export async function saveTableFieldsWithRelations(input: {
  tableId: string;
  fields: DataFieldInput[];
}): Promise<ServiceResult<{ affectedTableIds: string[] }>> {
  try {
    validateInputFields(input.fields);

    const affectedTableIds = new Set<string>([input.tableId]);

    await db.$transaction(async (tx) => {
      const table = await tx.dataTable.findUnique({
        where: { id: input.tableId },
        select: { id: true },
      });

      if (!table) {
        throw new FieldServiceError("NOT_FOUND", "数据表不存在");
      }

      const existingFields = (await tx.dataField.findMany({
        where: { tableId: input.tableId },
        include: {
          inverseField: true,
        },
        orderBy: { sortOrder: "asc" },
      })) as FieldRow[];

      const existingById = new Map(existingFields.map((field) => [field.id, field]));
      const existingByKey = new Map(existingFields.map((field) => [field.key, field]));
      const desiredIdOrKey = new Set(input.fields.map(getFieldIdentity));
      const sourceDisplayFieldCandidates = buildSourceDisplayFieldCandidates(input.fields);
      const tableKeyCache = new Map<string, Set<string>>();
      tableKeyCache.set(input.tableId, new Set(existingFields.map((field) => field.key)));

      // 先清理当前表中明确被移除的普通字段，避免后续 key 复用冲突。
      for (const existing of existingFields) {
        if (existing.isSystemManagedInverse) continue;
        if (desiredIdOrKey.has(existing.id) || desiredIdOrKey.has(existing.key)) continue;

        if (existing.inverseFieldId) {
          await tx.dataField.deleteMany({ where: { id: existing.inverseFieldId } });
        }

        await tx.dataField.deleteMany({ where: { id: existing.id } });
      }

      const keptIds = new Set<string>();

      for (const field of input.fields) {
        if (!isRelationSubtable(field)) {
          const matched = field.id ? existingById.get(field.id) : existingByKey.get(field.key);
          if (matched) {
            keptIds.add(matched.id);
          await tx.dataField.update({
            where: { id: matched.id },
            data: buildFieldUpdateData(field, matched),
          });
          } else {
            const created = await tx.dataField.create({
              data: buildFieldCreateData(input.tableId, field, existingFields.length),
            });
            keptIds.add(created.id);
          }
          continue;
        }

        if (!field.relationTo) {
          throw new FieldServiceError("MISSING_RELATION_TO", `字段 "${field.label}" 缺少关联表`);
        }
        affectedTableIds.add(field.relationTo);

        const matched = field.id ? existingById.get(field.id) : existingByKey.get(field.key);
        if (matched) {
          ensureForwardAndInverseAreCompatible(matched, field);
          assertLockedRelationFieldInput(matched, field);
          const nextSchema = field.relationSchema ?? (matched.relationSchema as DataFieldInput["relationSchema"] | null | undefined);
          assertNonDestructiveRelationSchema(matched.relationSchema, nextSchema, field.label);

          await tx.dataField.update({
            where: { id: matched.id },
            data: {
              ...buildFieldUpdateData(field, matched, nextSchema),
              relationTo: field.relationTo,
              relationCardinality: field.relationCardinality ?? null,
              relationSchema: relationSchemaToJson(nextSchema),
            },
          });

          keptIds.add(matched.id);

          if (matched.inverseFieldId) {
            const inverse = await tx.dataField.findUnique({
              where: { id: matched.inverseFieldId },
            });
            if (!inverse) {
              throw new FieldServiceError(
                "INVERSE_FIELD_NOT_FOUND",
                `字段 "${matched.label}" 的反向字段不存在`
              );
            }

            const nextInverseRelationCardinality = resolveInverseRelationCardinality(
              field,
              inverse.relationCardinality as PrismaRelationCardinality | null
            );
            if (inverse.relationCardinality !== nextInverseRelationCardinality) {
              throw new FieldServiceError(
                "RELATION_FIELD_LOCKED",
                `字段 "${matched.label}" 的 inverseRelationCardinality 已锁定，不能修改`
              );
            }

            // Do NOT propagate displayField from forward to inverse field.
            // Forward displayField points to a column in the TARGET table,
            // while inverse displayField must point to a column in the SOURCE table.
            // Keep the inverse's own displayField unless it was never set.
            const nextInverseDisplayField = inverse.displayField ?? null;

            await tx.dataField.update({
              where: { id: inverse.id },
              data: {
                key: inverse.key,
                label: inverse.label,
                required: inverse.required,
                options: inverse.options as Prisma.InputJsonValue | undefined,
                displayField: nextInverseDisplayField,
                defaultValue: inverse.defaultValue,
                sortOrder: inverse.sortOrder,
                relationCardinality: nextInverseRelationCardinality,
                relationSchema: relationSchemaToJson(nextSchema),
              },
            });
            keptIds.add(inverse.id);
            affectedTableIds.add(inverse.tableId);
          } else {
            const nextInverseRelationCardinality = resolveInverseRelationCardinality(field);
            const inverseId = await createInverseFieldPair(
              tx,
              tableKeyCache,
              input.tableId,
              field,
              matched.id,
              sourceDisplayFieldCandidates,
              nextInverseRelationCardinality
            );
            keptIds.add(inverseId);
            affectedTableIds.add(field.relationTo);
          }
          continue;
        }

        const nextSchema = field.relationSchema ?? null;
        const sourceField = await tx.dataField.create({
          data: buildFieldCreateData(input.tableId, field, existingFields.length),
        });
        keptIds.add(sourceField.id);

        const nextInverseRelationCardinality = resolveInverseRelationCardinality(field);
        const inverseId = await createInverseFieldPair(
          tx,
          tableKeyCache,
          input.tableId,
          field,
          sourceField.id,
          sourceDisplayFieldCandidates,
          nextInverseRelationCardinality
        );
        keptIds.add(inverseId);
        affectedTableIds.add(field.relationTo);

        // 新建字段时，关系 schema 直接按输入落库，不做破坏性约束判断。
        if (nextSchema) {
          await tx.dataField.update({
            where: { id: sourceField.id },
            data: {
              relationSchema: relationSchemaToJson(nextSchema),
            },
          });
        }
      }

      // 清理当前表中未保留的普通字段，系统托管反向字段只在对应正向字段删除时移除。
      for (const existing of existingFields) {
        if (keptIds.has(existing.id)) continue;
        if (existing.isSystemManagedInverse) continue;

        if (existing.inverseFieldId) {
          await tx.dataField.deleteMany({ where: { id: existing.inverseFieldId } });
        }

        await tx.dataField.deleteMany({ where: { id: existing.id } });
      }
    });

    return { success: true, data: { affectedTableIds: Array.from(affectedTableIds) } };
  } catch (error) {
    if (error instanceof FieldServiceError) {
      return { success: false, error: { code: error.code, message: error.message } };
    }

    const message = error instanceof Error ? error.message : "保存字段配置失败";
    return { success: false, error: { code: "SAVE_FAILED", message } };
  }
}
