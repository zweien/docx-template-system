import { beforeEach, describe, expect, it, vi } from "vitest";

const saveTableFieldsWithRelationsMock = vi.hoisted(() => vi.fn());
const invalidateCacheMock = vi.hoisted(() => vi.fn());

const dbMock = vi.hoisted(() => ({
  dataTable: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
  },
  dataField: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("./data-field.service", () => ({
  saveTableFieldsWithRelations: saveTableFieldsWithRelationsMock,
}));

vi.mock("@/lib/cache", () => ({
  withCache: async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn(),
  invalidateCache: invalidateCacheMock,
  CACHE_TTL: {
    TABLE_DEF: 300000,
    RELATIONS: 60000,
  },
}));

describe("data-table.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getTable 应回填完整关系元数据和 businessKeys", async () => {
    dbMock.dataTable.findUnique.mockResolvedValue({
      id: "paper_table_id",
      name: "paper",
      description: null,
      icon: null,
      businessKeys: ["title"],
      createdAt: new Date("2026-04-03T00:00:00.000Z"),
      updatedAt: new Date("2026-04-03T00:00:00.000Z"),
      fields: [
        {
          id: "field-1",
          key: "authors",
          label: "作者",
          type: "RELATION_SUBTABLE",
          required: false,
          options: null,
          relationTo: "author_table_id",
          displayField: "name",
          relationCardinality: "SINGLE",
          inverseFieldId: "inverse-1",
          isSystemManagedInverse: false,
          relationSchema: {
            version: 1,
            fields: [{ key: "author_order", label: "作者顺序", type: "NUMBER", required: true, sortOrder: 0 }],
          },
          defaultValue: null,
          sortOrder: 0,
          inverseField: {
            key: "paper_authors_inverse",
            relationCardinality: "MULTIPLE",
          },
        },
      ],
      _count: { records: 3 },
    });

    const { getTable } = await import("./data-table.service");
    const result = await getTable("paper_table_id");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.businessKeys).toEqual(["title"]);
        expect(result.data.fields[0]).toMatchObject({
          relationCardinality: "SINGLE",
          inverseFieldId: "inverse-1",
          inverseRelationCardinality: "MULTIPLE",
          inverseFieldKey: "paper_authors_inverse",
          isSystemManagedInverse: false,
          relationSchema: {
            version: 1,
          fields: [{ key: "author_order", label: "作者顺序", type: "NUMBER", required: true, sortOrder: 0 }],
        },
      });
    }
  });

  it("createTable 和 updateTable 应回填 businessKeys", async () => {
    dbMock.dataTable.findUnique.mockResolvedValue(null);
    dbMock.dataTable.create.mockResolvedValue({
      id: "paper_table_id",
      name: "paper",
      description: null,
      icon: null,
      businessKeys: ["title"],
      createdAt: new Date("2026-04-03T00:00:00.000Z"),
      updatedAt: new Date("2026-04-03T00:00:00.000Z"),
      fields: [],
      _count: { records: 0 },
    });
    dbMock.dataTable.findFirst.mockResolvedValue(null);
    dbMock.dataTable.update.mockResolvedValue({
      id: "paper_table_id",
      name: "paper",
      description: null,
      icon: null,
      businessKeys: ["title"],
      createdAt: new Date("2026-04-03T00:00:00.000Z"),
      updatedAt: new Date("2026-04-03T00:00:00.000Z"),
      fields: [
        {
          id: "field-1",
          key: "authors",
          label: "作者",
          type: "RELATION_SUBTABLE",
          required: false,
          options: null,
          relationTo: "author_table_id",
          displayField: "name",
          relationCardinality: "SINGLE",
          inverseFieldId: "inverse-1",
          isSystemManagedInverse: false,
          relationSchema: null,
          defaultValue: null,
          sortOrder: 0,
          inverseField: {
            key: "paper_authors_inverse",
            relationCardinality: "MULTIPLE",
          },
        },
      ],
      _count: { records: 0 },
    });

    const service = await import("./data-table.service");

    const created = await service.createTable("user-1", { name: "paper" });
    expect(created.success).toBe(true);
    if (created.success) {
      expect(created.data.businessKeys).toEqual(["title"]);
    }

    const updated = await service.updateTable("paper_table_id", { name: "paper" });
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.data.businessKeys).toEqual(["title"]);
      expect(updated.data.fields[0]).toMatchObject({
        inverseRelationCardinality: "MULTIPLE",
        inverseFieldKey: "paper_authors_inverse",
      });
    }
  });

  it("updateFields 应失效当前表和对端表缓存", async () => {
    saveTableFieldsWithRelationsMock.mockResolvedValue({
      success: true,
      data: { affectedTableIds: ["author_table_id"] },
    });
    dbMock.dataField.findMany.mockResolvedValue([
      {
        id: "field-1",
        key: "authors",
        label: "作者",
        type: "RELATION_SUBTABLE",
        required: false,
        options: null,
        relationTo: "author_table_id",
        displayField: "name",
        relationCardinality: "MULTIPLE",
        inverseFieldId: "inverse-1",
        isSystemManagedInverse: false,
        relationSchema: null,
        defaultValue: null,
        sortOrder: 0,
        inverseField: {
          key: "paper_authors_inverse",
          relationCardinality: "MULTIPLE",
        },
      },
    ]);

    const service = await import("./data-table.service");
    const result = await service.updateFields("paper_table_id", []);

    expect(result.success).toBe(true);
    expect(invalidateCacheMock).toHaveBeenCalledWith("table:paper_table_id");
    expect(invalidateCacheMock).toHaveBeenCalledWith("table:author_table_id");
  });
});
