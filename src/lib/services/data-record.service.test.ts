import { beforeEach, describe, expect, it, vi } from "vitest";

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

const records = vi.hoisted(() => new Map<string, FakeRecordRow>());

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (tx: typeof dbMock) => Promise<unknown>) => callback(dbMock)),
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
    records.clear();
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
});
