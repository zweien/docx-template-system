import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RelationCardinality } from "@/types/data-table";

const getTableMock = vi.hoisted(() => vi.fn());
const syncRelationSubtableValuesMock = vi.hoisted(() => vi.fn());
const removeAllRelationsForRecordMock = vi.hoisted(() => vi.fn());

type FakeRecordRow = {
  id: string;
  tableId: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { name: string };
};

type FakeFieldRow = {
  id: string;
  tableId: string;
  key: string;
  type: "TEXT" | "RELATION_SUBTABLE";
  relationTo: string | null;
  displayField: string | null;
  relationCardinality: RelationCardinality | null;
  inverseFieldId: string | null;
  inverseField?: {
    id: string;
    key: string;
    relationCardinality: RelationCardinality | null;
  } | null;
};

type FakeRelationRow = {
  id: string;
  fieldId: string;
  sourceRecordId: string;
  targetRecordId: string;
  attributes: unknown;
  sortOrder: number;
};

const records = vi.hoisted(() => new Map<string, FakeRecordRow>());
const fields = vi.hoisted(() => new Map<string, FakeFieldRow>());
const relationRows = vi.hoisted(() => new Map<string, FakeRelationRow>());

function matchesRelationWhere(
  row: FakeRelationRow,
  where?: {
    fieldId?: string | { in?: string[] };
    sourceRecordId?: string | { in?: string[] };
    targetRecordId?: string | { in?: string[] };
    OR?: Array<{
      sourceRecordId?: string | { in?: string[] };
      targetRecordId?: string | { in?: string[] };
    }>;
    NOT?: { sourceRecordId?: string };
  }
) {
  if (!where) return true;
  if (typeof where.fieldId === "string" && row.fieldId !== where.fieldId) return false;
  if (typeof where.fieldId === "object" && where.fieldId.in && !where.fieldId.in.includes(row.fieldId)) {
    return false;
  }
  if (typeof where.sourceRecordId === "string" && row.sourceRecordId !== where.sourceRecordId) return false;
  if (
    typeof where.sourceRecordId === "object" &&
    where.sourceRecordId.in &&
    !where.sourceRecordId.in.includes(row.sourceRecordId)
  ) {
    return false;
  }
  if (typeof where.targetRecordId === "string" && row.targetRecordId !== where.targetRecordId) return false;
  if (
    typeof where.targetRecordId === "object" &&
    where.targetRecordId.in &&
    !where.targetRecordId.in.includes(row.targetRecordId)
  ) {
    return false;
  }
  if (where.NOT?.sourceRecordId && row.sourceRecordId === where.NOT.sourceRecordId) return false;
  if (where.OR && !where.OR.some((item) => (
    (typeof item.sourceRecordId === "string"
      ? row.sourceRecordId === item.sourceRecordId
      : item.sourceRecordId?.in
        ? item.sourceRecordId.in.includes(row.sourceRecordId)
        : true) &&
    (typeof item.targetRecordId === "string"
      ? row.targetRecordId === item.targetRecordId
      : item.targetRecordId?.in
        ? item.targetRecordId.in.includes(row.targetRecordId)
        : true)
  ))) {
    return false;
  }
  return true;
}

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (tx: typeof dbMock) => Promise<unknown>) => callback(dbMock)),
  $queryRawUnsafe: vi.fn(async () => []),
  dataRecord: {
    create: vi.fn(async ({ data }: { data: { tableId: string; data: Record<string, unknown>; createdById: string } }) => {
      const id = `record-${records.size + 1}`;
      const record = {
        id,
        tableId: data.tableId,
        data: structuredClone(data.data),
        createdAt: new Date("2026-04-03T00:00:00.000Z"),
        updatedAt: new Date("2026-04-03T00:00:00.000Z"),
        createdBy: { name: "测试用户" },
      };
      records.set(id, record);
      return structuredClone(record);
    }),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      const record = records.get(where.id);
      return record ? structuredClone(record) : null;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: { data: Record<string, unknown> } }) => {
      const record = records.get(where.id);
      if (!record) throw new Error(`record ${where.id} not found`);
      record.data = structuredClone(data.data);
      return structuredClone(record);
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      records.delete(where.id);
      return { id: where.id };
    }),
    findMany: vi.fn(async ({ where }: { where?: { id?: { in: string[] }; tableId?: string } } = {}) =>
      [...records.values()]
        .filter((record) => {
          if (where?.id?.in && !where.id.in.includes(record.id)) return false;
          if (where?.tableId && record.tableId !== where.tableId) return false;
          return true;
        })
        .map((record) => structuredClone(record))
    ),
  },
  dataField: {
    findMany: vi.fn(async ({
      where,
    }: {
      where?: {
        tableId?: string | { in?: string[] };
        type?: "RELATION_SUBTABLE";
        key?: { in: string[] };
      };
    } = {}) =>
      [...fields.values()]
        .filter((field) => {
          if (typeof where?.tableId === "string" && field.tableId !== where.tableId) return false;
          if (typeof where?.tableId === "object" && where.tableId.in && !where.tableId.in.includes(field.tableId)) {
            return false;
          }
          if (where?.type && field.type !== where.type) return false;
          if (where?.key?.in && !where.key.in.includes(field.key)) return false;
          return true;
        })
        .map((field) => structuredClone(field))
    ),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      const field = fields.get(where.id);
      return field ? structuredClone(field) : null;
    }),
  },
  dataRelationRow: {
    findMany: vi.fn(async ({ where }: { where?: Parameters<typeof matchesRelationWhere>[1] } = {}) =>
      [...relationRows.values()]
        .filter((row) => matchesRelationWhere(row, where))
        .map((row) => ({
          ...structuredClone(row),
          field: fields.get(row.fieldId) ? structuredClone(fields.get(row.fieldId)) : null,
        }))
    ),
    create: vi.fn(async ({ data }: { data: Omit<FakeRelationRow, "id"> }) => {
      const row = {
        id: `relation-${relationRows.size + 1}`,
        ...structuredClone(data),
      };
      relationRows.set(row.id, row);
      return structuredClone(row);
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Omit<FakeRelationRow, "id">> }) => {
      const row = relationRows.get(where.id);
      if (!row) throw new Error(`relation row ${where.id} not found`);
      Object.assign(row, structuredClone(data));
      return structuredClone(row);
    }),
    deleteMany: vi.fn(async ({ where }: { where?: Parameters<typeof matchesRelationWhere>[1] } = {}) => {
      const ids = [...relationRows.values()]
        .filter((row) => matchesRelationWhere(row, where))
        .map((row) => row.id);
      ids.forEach((id) => relationRows.delete(id));
      return { count: ids.length };
    }),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("./data-table.service", () => ({
  getTable: getTableMock,
}));

vi.mock("./data-relation.service", () => ({
  syncRelationSubtableValues: syncRelationSubtableValuesMock,
  removeAllRelationsForRecord: removeAllRelationsForRecordMock,
}));

describe("data-record.service relation snapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.doMock("./data-relation.service", () => ({
      syncRelationSubtableValues: syncRelationSubtableValuesMock,
      removeAllRelationsForRecord: removeAllRelationsForRecordMock,
    }));
    records.clear();
    fields.clear();
    relationRows.clear();
    getTableMock.mockResolvedValue({
      success: true,
      data: {
        id: "paper-table",
        name: "paper",
        description: null,
        icon: null,
        fieldCount: 2,
        recordCount: 0,
        createdAt: new Date("2026-04-03T00:00:00.000Z"),
        fields: [
          {
            id: "title-field",
            key: "title",
            label: "标题",
            type: "TEXT",
            required: true,
            sortOrder: 0,
          },
          {
            id: "authors-field",
            key: "authors",
            label: "作者",
            type: "RELATION_SUBTABLE",
            required: false,
            relationTo: "author-table",
            displayField: "name",
            relationCardinality: "MULTIPLE",
            inverseFieldId: "papers-field",
            inverseRelationCardinality: "MULTIPLE",
            isSystemManagedInverse: false,
            relationSchema: null,
            sortOrder: 1,
          },
        ],
      },
    });
    syncRelationSubtableValuesMock.mockImplementation(
      async ({ tx, sourceRecordId }: { tx: typeof dbMock; sourceRecordId: string }) => {
        const record = records.get(sourceRecordId);
        if (record) {
          record.data = {
            ...record.data,
            authors: [
              {
                targetRecordId: "author-1",
                displayValue: "Ada",
                attributes: { role: "第一作者" },
                sortOrder: 0,
              },
            ],
          };
          await tx.dataRecord.update({
            where: { id: sourceRecordId },
            data: { data: record.data as Record<string, unknown> },
          });
        }
        return { success: true, data: null };
      }
    );
    removeAllRelationsForRecordMock.mockResolvedValue({ success: true, data: null });
  });

  it("createRecord 保存关系子表格字段后可读回 JSONB 快照", async () => {
    const { createRecord, getRecord } = await import("./data-record.service");

    const created = await createRecord("user-1", "paper-table", {
      title: "论文 A",
      authors: [
        {
          targetRecordId: "author-1",
          displayValue: "Ada",
          attributes: { role: "第一作者" },
          sortOrder: 0,
        },
      ],
    });

    expect(created.success).toBe(true);
    if (created.success) {
      const recordResult = await getRecord(created.data.id);
      expect(recordResult.success).toBe(true);
      if (recordResult.success) {
        expect(recordResult.data.data).toMatchObject({
          title: "论文 A",
          authors: [
            {
              targetRecordId: "author-1",
              displayValue: "Ada",
              attributes: { role: "第一作者" },
              sortOrder: 0,
            },
          ],
        });
      }
    }
    expect(syncRelationSubtableValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceRecordId: expect.any(String),
        tableId: "paper-table",
        relationPayload: {
          authors: [
            {
              targetRecordId: "author-1",
              displayValue: "Ada",
              attributes: { role: "第一作者" },
              sortOrder: 0,
            },
          ],
        },
      })
    );
    expect(dbMock.dataRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          data: { title: "论文 A" },
        }),
      })
    );
  });

  it("deleteRecord 删除记录前会清理对端关系快照", async () => {
    records.set("record-1", {
      id: "record-1",
      tableId: "paper-table",
      data: {
        title: "论文 A",
        authors: [
          {
            targetRecordId: "author-1",
            displayValue: "Ada",
            attributes: { role: "第一作者" },
            sortOrder: 0,
          },
        ],
      },
      createdAt: new Date("2026-04-03T00:00:00.000Z"),
      updatedAt: new Date("2026-04-03T00:00:00.000Z"),
      createdBy: { name: "测试用户" },
    });

    const { deleteRecord } = await import("./data-record.service");
    const result = await deleteRecord("record-1");

    expect(result.success).toBe(true);
    expect(removeAllRelationsForRecordMock).toHaveBeenCalledWith({
      tx: dbMock,
      recordId: "record-1",
    });
    expect(dbMock.dataRecord.delete).toHaveBeenCalledWith({ where: { id: "record-1" } });
  });

  it("updateRecord 更新 target display 字段后会刷新 source 快照", async () => {
    vi.doUnmock("./data-relation.service");

    fields.set("paper-authors-field", {
      id: "paper-authors-field",
      tableId: "paper-table",
      key: "authors",
      type: "RELATION_SUBTABLE",
      relationTo: "author-table",
      displayField: "name",
      relationCardinality: "MULTIPLE",
      inverseFieldId: "author-papers-field",
      inverseField: {
        id: "author-papers-field",
        key: "papers",
        relationCardinality: "MULTIPLE",
      },
    });
    fields.set("author-name-field", {
      id: "author-name-field",
      tableId: "author-table",
      key: "name",
      type: "TEXT",
      relationTo: null,
      displayField: null,
      relationCardinality: null,
      inverseFieldId: null,
      inverseField: null,
    });
    fields.set("author-papers-field", {
      id: "author-papers-field",
      tableId: "author-table",
      key: "papers",
      type: "RELATION_SUBTABLE",
      relationTo: "paper-table",
      displayField: "title",
      relationCardinality: "MULTIPLE",
      inverseFieldId: "paper-authors-field",
      inverseField: {
        id: "paper-authors-field",
        key: "authors",
        relationCardinality: "MULTIPLE",
      },
    });
    records.set("paper-1", {
      id: "paper-1",
      tableId: "paper-table",
      data: {
        title: "论文 A",
        authors: [
          {
            targetRecordId: "author-1",
            displayValue: "Ada",
            attributes: { role: "第一作者" },
            sortOrder: 0,
          },
        ],
      },
      createdAt: new Date("2026-04-03T00:00:00.000Z"),
      updatedAt: new Date("2026-04-03T00:00:00.000Z"),
      createdBy: { name: "测试用户" },
    });
    records.set("author-1", {
      id: "author-1",
      tableId: "author-table",
      data: {
        name: "Ada",
        papers: [
          {
            targetRecordId: "paper-1",
            displayValue: "论文 A",
            attributes: { role: "第一作者" },
            sortOrder: 0,
          },
        ],
      },
      createdAt: new Date("2026-04-03T00:00:00.000Z"),
      updatedAt: new Date("2026-04-03T00:00:00.000Z"),
      createdBy: { name: "测试用户" },
    });
    relationRows.set("relation-1", {
      id: "relation-1",
      fieldId: "paper-authors-field",
      sourceRecordId: "paper-1",
      targetRecordId: "author-1",
      attributes: { version: 1, values: { role: "第一作者" } },
      sortOrder: 0,
    });
    getTableMock.mockResolvedValue({
      success: true,
      data: {
        id: "author-table",
        name: "author",
        description: null,
        icon: null,
        fieldCount: 2,
        recordCount: 1,
        createdAt: new Date("2026-04-03T00:00:00.000Z"),
        fields: [
          {
            id: "author-name-field",
            key: "name",
            label: "姓名",
            type: "TEXT",
            required: true,
            sortOrder: 0,
          },
          {
            id: "author-papers-field",
            key: "papers",
            label: "论文",
            type: "RELATION_SUBTABLE",
            required: false,
            relationTo: "paper-table",
            displayField: "title",
            relationCardinality: "MULTIPLE",
            inverseFieldId: "paper-authors-field",
            inverseRelationCardinality: "MULTIPLE",
            isSystemManagedInverse: true,
            relationSchema: null,
            sortOrder: 1,
          },
        ],
      },
    });

    const { updateRecord } = await import("./data-record.service");
    const result = await updateRecord("author-1", { name: "Ada Lovelace" });

    expect(result.success).toBe(true);
    expect(records.get("paper-1")?.data.authors).toEqual([
      {
        targetRecordId: "author-1",
        displayValue: "Ada Lovelace",
        attributes: { role: "第一作者" },
        sortOrder: 0,
      },
    ]);
  });
});
