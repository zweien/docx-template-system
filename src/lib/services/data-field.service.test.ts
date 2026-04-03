import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveTableFieldsWithRelations } from "./data-field.service";

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  dataTable: {
    findUnique: vi.fn(),
  },
  dataField: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

describe("saveTableFieldsWithRelations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates forward and inverse relation subtable fields as a locked pair", async () => {
    const createdFields: Array<Record<string, unknown>> = [];

    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof dbMock) => Promise<unknown>) =>
      callback(dbMock)
    );
    dbMock.dataTable.findUnique.mockResolvedValue({ id: "paper_table_id" });
    dbMock.dataField.findMany.mockImplementation(async ({ where }: { where?: { tableId?: string } }) => {
      if (where?.tableId === "paper_table_id") {
        return [];
      }
      if (where?.tableId === "author_table_id") {
        return [];
      }
      return [];
    });
    dbMock.dataField.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      const created = {
        id: `field_${createdFields.length + 1}`,
        ...data,
      };
      createdFields.push(created);
      return created;
    });
    dbMock.dataField.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
      id: where.id,
      ...data,
    }));
    dbMock.dataField.deleteMany.mockResolvedValue({ count: 0 });

    const result = await saveTableFieldsWithRelations({
      tableId: "paper_table_id",
      fields: [
        {
          key: "authors",
          label: "作者",
          type: "RELATION_SUBTABLE" as never,
          required: false,
          relationTo: "author_table_id",
          displayField: "name",
          relationCardinality: "MULTIPLE",
          relationSchema: {
            version: 1,
            fields: [
              {
                key: "author_order",
                label: "作者顺序",
                type: "NUMBER" as never,
                required: true,
                sortOrder: 0,
              },
            ],
          },
          sortOrder: 0,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(dbMock.dataField.create).toHaveBeenCalledTimes(2);
    expect(createdFields).toHaveLength(2);

    expect(dbMock.dataField.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          tableId: "paper_table_id",
          key: "authors",
          relationTo: "author_table_id",
        }),
      })
    );

    expect(dbMock.dataField.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          tableId: "author_table_id",
          relationTo: "paper_table_id",
          isSystemManagedInverse: true,
        }),
      })
    );
  });
});
