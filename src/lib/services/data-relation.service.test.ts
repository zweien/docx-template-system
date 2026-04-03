import { beforeEach, describe, expect, it } from "vitest";
import type { RelationCardinality, RelationSubtableValueItem } from "@/types/data-table";
import { removeAllRelationsForRecord, syncRelationSubtableValues } from "./data-relation.service";

type FakeFieldRow = {
  id: string;
  tableId: string;
  key: string;
  type: "TEXT" | "RELATION_SUBTABLE";
  relationTo: string | null;
  displayField: string | null;
  relationCardinality: RelationCardinality | null;
  inverseFieldId: string | null;
  inverseField: {
    id: string;
    key: string;
    relationCardinality: RelationCardinality | null;
  } | null;
};

type FakeRecordRow = {
  id: string;
  tableId: string;
  data: Record<string, unknown>;
};

type FakeRelationRow = {
  id: string;
  fieldId: string;
  sourceRecordId: string;
  targetRecordId: string;
  attributes: unknown;
  sortOrder: number;
};

function createFakeTx(input: {
  fields: FakeFieldRow[];
  records: FakeRecordRow[];
  relationRows?: FakeRelationRow[];
}) {
  const fields = new Map(input.fields.map((field) => [field.id, { ...field }]));
  const fieldsByTable = new Map<string, FakeFieldRow[]>();
  for (const field of input.fields) {
    fieldsByTable.set(field.tableId, [...(fieldsByTable.get(field.tableId) ?? []), { ...field }]);
  }

  const records = new Map(
    input.records.map((record) => [record.id, { ...record, data: { ...record.data } }])
  );
  const relationRows = new Map(
    (input.relationRows ?? []).map((row) => [row.id, { ...row, attributes: structuredClone(row.attributes) }])
  );
  let nextRelationId = relationRows.size + 1;

  const matchesRelationWhere = (
    row: FakeRelationRow,
    where?: {
      fieldId?: string | { in?: string[] };
      sourceRecordId?: string;
      targetRecordId?: string | { in?: string[] };
      OR?: Array<{ sourceRecordId?: string; targetRecordId?: string }>;
      NOT?: { sourceRecordId?: string };
    }
  ) => {
    if (!where) return true;

    if (typeof where.fieldId === "string" && row.fieldId !== where.fieldId) return false;
    if (typeof where.fieldId === "object" && where.fieldId.in && !where.fieldId.in.includes(row.fieldId)) {
      return false;
    }
    if (where.sourceRecordId && row.sourceRecordId !== where.sourceRecordId) return false;
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
      (item.sourceRecordId ? row.sourceRecordId === item.sourceRecordId : true) &&
      (item.targetRecordId ? row.targetRecordId === item.targetRecordId : true)
    ))) {
      return false;
    }

    return true;
  };

  const tx = {
    dataField: {
      findMany: async ({
        where,
      }: {
        where?: {
          tableId?: string;
          type?: "RELATION_SUBTABLE";
          key?: { in: string[] };
        };
      } = {}) => {
        const rows = where?.tableId ? (fieldsByTable.get(where.tableId) ?? []) : [...fields.values()];
        return rows.filter((field) => {
          if (where?.type && field.type !== where.type) return false;
          if (where?.key?.in && !where.key.in.includes(field.key)) return false;
          return true;
        });
      },
      findUnique: async ({ where }: { where: { id: string } }) => fields.get(where.id) ?? null,
    },
    dataRecord: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const record = records.get(where.id);
        return record ? { ...record, data: { ...record.data } } : null;
      },
      findMany: async ({
        where,
      }: {
        where?: { id?: { in: string[] }; tableId?: string };
      } = {}) => {
        return [...records.values()].filter((record) => {
          if (where?.id?.in && !where.id.in.includes(record.id)) return false;
          if (where?.tableId && record.tableId !== where.tableId) return false;
          return true;
        }).map((record) => ({ ...record, data: { ...record.data } }));
      },
      update: async ({ where, data }: { where: { id: string }; data: { data: Record<string, unknown> } }) => {
        const record = records.get(where.id);
        if (!record) throw new Error(`record ${where.id} not found`);
        record.data = structuredClone(data.data);
        return { ...record, data: { ...record.data } };
      },
    },
    dataRelationRow: {
      findMany: async ({ where }: { where?: Parameters<typeof matchesRelationWhere>[1] } = {}) =>
        [...relationRows.values()]
          .filter((row) => matchesRelationWhere(row, where))
          .map((row) => ({ ...row, attributes: structuredClone(row.attributes), field: fields.get(row.fieldId) })),
      create: async ({ data }: { data: Omit<FakeRelationRow, "id"> }) => {
        const row = { id: `relation-${nextRelationId++}`, ...data, attributes: structuredClone(data.attributes) };
        relationRows.set(row.id, row);
        return { ...row };
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Omit<FakeRelationRow, "id">> }) => {
        const row = relationRows.get(where.id);
        if (!row) throw new Error(`relation row ${where.id} not found`);
        Object.assign(row, structuredClone(data));
        return { ...row };
      },
      deleteMany: async ({ where }: { where?: Parameters<typeof matchesRelationWhere>[1] } = {}) => {
        const ids = [...relationRows.values()]
          .filter((row) => matchesRelationWhere(row, where))
          .map((row) => row.id);
        ids.forEach((id) => relationRows.delete(id));
        return { count: ids.length };
      },
    },
  };

  return {
    tx,
    getRecord: (id: string) => records.get(id),
    getRelationRows: () => [...relationRows.values()].map((row) => ({ ...row, attributes: structuredClone(row.attributes) })),
  };
}

describe("syncRelationSubtableValues", () => {
  let authorField: FakeFieldRow;
  let paperInverseField: FakeFieldRow;

  beforeEach(() => {
    authorField = {
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
    };
    paperInverseField = {
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
    };
  });

  it("syncs many-to-many rows and inverse snapshots", async () => {
    const store = createFakeTx({
      fields: [authorField, paperInverseField],
      records: [
        { id: "paper-1", tableId: "paper-table", data: { title: "论文 A", authors: [] } },
        { id: "author-1", tableId: "author-table", data: { name: "Ada", papers: [] } },
        { id: "author-2", tableId: "author-table", data: { name: "Lin", papers: [] } },
      ],
    });

    const result = await syncRelationSubtableValues({
      tx: store.tx,
      sourceRecordId: "paper-1",
      tableId: "paper-table",
      relationPayload: {
        authors: [
          {
            targetRecordId: "author-2",
            displayValue: "Lin",
            attributes: { role: "通讯作者" },
            sortOrder: 1,
          },
          {
            targetRecordId: "author-1",
            displayValue: "Ada",
            attributes: { role: "第一作者" },
            sortOrder: 0,
          },
        ] satisfies RelationSubtableValueItem[],
      },
    });

    expect(result.success).toBe(true);
    expect(store.getRelationRows()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldId: "paper-authors-field",
          sourceRecordId: "paper-1",
          targetRecordId: "author-1",
          attributes: { version: 1, values: { role: "第一作者" } },
          sortOrder: 0,
        }),
        expect.objectContaining({
          fieldId: "paper-authors-field",
          sourceRecordId: "paper-1",
          targetRecordId: "author-2",
          attributes: { version: 1, values: { role: "通讯作者" } },
          sortOrder: 1,
        }),
      ])
    );
    expect(store.getRecord("paper-1")?.data.authors).toEqual([
      {
        targetRecordId: "author-1",
        displayValue: "Ada",
        attributes: { role: "第一作者" },
        sortOrder: 0,
      },
      {
        targetRecordId: "author-2",
        displayValue: "Lin",
        attributes: { role: "通讯作者" },
        sortOrder: 1,
      },
    ]);
    expect(store.getRecord("author-1")?.data.papers).toEqual([
      {
        targetRecordId: "paper-1",
        displayValue: "论文 A",
        attributes: { role: "第一作者" },
        sortOrder: 0,
      },
    ]);
  });

  it("rejects duplicate target rows for SINGLE cardinality", async () => {
    const store = createFakeTx({
      fields: [
        {
          ...authorField,
          relationCardinality: "SINGLE",
          inverseField: { id: "author-papers-field", key: "papers", relationCardinality: "MULTIPLE" },
        },
        paperInverseField,
      ],
      records: [
        { id: "paper-1", tableId: "paper-table", data: { title: "论文 A", authors: null } },
        { id: "author-1", tableId: "author-table", data: { name: "Ada", papers: [] } },
        { id: "author-2", tableId: "author-table", data: { name: "Lin", papers: [] } },
      ],
    });

    const result = await syncRelationSubtableValues({
      tx: store.tx,
      sourceRecordId: "paper-1",
      tableId: "paper-table",
      relationPayload: {
        authors: [
          { targetRecordId: "author-1", attributes: { role: "第一作者" }, sortOrder: 0 },
          { targetRecordId: "author-2", attributes: { role: "通讯作者" }, sortOrder: 1 },
        ],
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("RELATION_CARDINALITY_VIOLATION");
    }
    expect(store.getRelationRows()).toHaveLength(0);
  });

  it("rejects sourceRecordId that does not belong to tableId", async () => {
    const store = createFakeTx({
      fields: [authorField, paperInverseField],
      records: [
        { id: "paper-1", tableId: "wrong-table", data: { title: "论文 A", authors: [] } },
        { id: "author-1", tableId: "author-table", data: { name: "Ada", papers: [] } },
      ],
    });

    const result = await syncRelationSubtableValues({
      tx: store.tx,
      sourceRecordId: "paper-1",
      tableId: "paper-table",
      relationPayload: {
        authors: [{ targetRecordId: "author-1", attributes: { role: "第一作者" }, sortOrder: 0 }],
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_SOURCE_TABLE");
    }
    expect(store.getRelationRows()).toEqual([]);
  });

  it("rejects targetRecordId that does not belong to relationTo", async () => {
    const store = createFakeTx({
      fields: [authorField, paperInverseField],
      records: [
        { id: "paper-1", tableId: "paper-table", data: { title: "论文 A", authors: [] } },
        { id: "wrong-author-1", tableId: "paper-table", data: { name: "Ada", papers: [] } },
      ],
    });

    const result = await syncRelationSubtableValues({
      tx: store.tx,
      sourceRecordId: "paper-1",
      tableId: "paper-table",
      relationPayload: {
        authors: [{ targetRecordId: "wrong-author-1", attributes: { role: "第一作者" }, sortOrder: 0 }],
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_TARGET_TABLE");
    }
    expect(store.getRelationRows()).toEqual([]);
  });

  it("rejects targets already occupied by another source when inverse cardinality is SINGLE", async () => {
    const store = createFakeTx({
      fields: [
        {
          ...authorField,
          relationCardinality: "MULTIPLE",
          inverseField: { id: "author-papers-field", key: "papers", relationCardinality: "SINGLE" },
        },
        {
          ...paperInverseField,
          relationCardinality: "SINGLE",
          inverseField: { id: "paper-authors-field", key: "authors", relationCardinality: "MULTIPLE" },
        },
      ],
      records: [
        { id: "paper-1", tableId: "paper-table", data: { title: "论文 A", authors: [] } },
        { id: "paper-2", tableId: "paper-table", data: { title: "论文 B", authors: [] } },
        { id: "author-1", tableId: "author-table", data: { name: "Ada", papers: null } },
      ],
      relationRows: [
        {
          id: "relation-1",
          fieldId: "paper-authors-field",
          sourceRecordId: "paper-2",
          targetRecordId: "author-1",
          attributes: { version: 1, values: { role: "作者" } },
          sortOrder: 0,
        },
      ],
    });

    const result = await syncRelationSubtableValues({
      tx: store.tx,
      sourceRecordId: "paper-1",
      tableId: "paper-table",
      relationPayload: {
        authors: [{ targetRecordId: "author-1", attributes: { role: "第一作者" }, sortOrder: 0 }],
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVERSE_RELATION_CARDINALITY_VIOLATION");
    }
    expect(store.getRelationRows()).toHaveLength(1);
  });

  it("removes inverse references when a relation row is deleted", async () => {
    const store = createFakeTx({
      fields: [authorField, paperInverseField],
      records: [
        {
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
        },
        {
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
        },
      ],
      relationRows: [
        {
          id: "relation-1",
          fieldId: "paper-authors-field",
          sourceRecordId: "paper-1",
          targetRecordId: "author-1",
          attributes: { version: 1, values: { role: "第一作者" } },
          sortOrder: 0,
        },
      ],
    });

    const result = await syncRelationSubtableValues({
      tx: store.tx,
      sourceRecordId: "paper-1",
      tableId: "paper-table",
      relationPayload: {
        authors: [],
      },
    });

    expect(result.success).toBe(true);
    expect(store.getRelationRows()).toEqual([]);
    expect(store.getRecord("paper-1")?.data.authors).toEqual([]);
    expect(store.getRecord("author-1")?.data.papers).toEqual([]);
  });
});

describe("removeAllRelationsForRecord", () => {
  it("clears rows and refreshes counterpart snapshots", async () => {
    const store = createFakeTx({
      fields: [
        {
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
        },
        {
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
        },
      ],
      records: [
        {
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
        },
        {
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
        },
      ],
      relationRows: [
        {
          id: "relation-1",
          fieldId: "paper-authors-field",
          sourceRecordId: "paper-1",
          targetRecordId: "author-1",
          attributes: { version: 1, values: { role: "第一作者" } },
          sortOrder: 0,
        },
      ],
    });

    const result = await removeAllRelationsForRecord({
      tx: store.tx,
      recordId: "paper-1",
    });

    expect(result.success).toBe(true);
    expect(store.getRelationRows()).toEqual([]);
    expect(store.getRecord("author-1")?.data.papers).toEqual([]);
  });
});
