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

function buildFieldRow(overrides: Record<string, unknown>) {
  return {
    id: "field-1",
    tableId: "paper_table_id",
    key: "authors",
    label: "作者",
    type: "RELATION_SUBTABLE",
    required: false,
    options: null,
    relationTo: "author_table_id",
    displayField: "name",
    relationCardinality: "MULTIPLE",
    inverseFieldId: null,
    isSystemManagedInverse: false,
    relationSchema: null,
    defaultValue: null,
    sortOrder: 0,
    inverseField: null,
    ...overrides,
  };
}

function setupTransaction({
  currentFields,
  targetFields = [],
}: {
  currentFields: Array<Record<string, unknown>>;
  targetFields?: Array<Record<string, unknown>>;
}) {
  dbMock.$transaction.mockImplementation(async (callback: (tx: typeof dbMock) => Promise<unknown>) =>
    callback(dbMock)
  );
  dbMock.dataTable.findUnique.mockResolvedValue({ id: "paper_table_id" });
  dbMock.dataField.findMany.mockImplementation(async ({ where }: { where?: { tableId?: string } }) => {
    if (where?.tableId === "paper_table_id") {
      return currentFields;
    }
    if (where?.tableId === "author_table_id") {
      return targetFields;
    }
    return [];
  });
  dbMock.dataField.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: `created-${dbMock.dataField.create.mock.calls.length}`,
    ...data,
  }));
  dbMock.dataField.update.mockResolvedValue({ id: "updated-1" });
  dbMock.dataField.deleteMany.mockResolvedValue({ count: 0 });
}

describe("saveTableFieldsWithRelations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates forward and inverse relation subtable fields as a locked pair", async () => {
    setupTransaction({
      currentFields: [
        { id: "title-1", key: "title", type: "TEXT" },
        { id: "summary-1", key: "summary", type: "TEXT" },
      ],
    });

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
          relationCardinality: "SINGLE",
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
    expect(dbMock.dataField.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          tableId: "paper_table_id",
          key: "authors",
          relationTo: "author_table_id",
          relationCardinality: "SINGLE",
        }),
      })
    );
    expect(dbMock.dataField.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          tableId: "author_table_id",
          relationTo: "paper_table_id",
          relationCardinality: "SINGLE",
          displayField: "title",
          isSystemManagedInverse: true,
        }),
      })
    );
  });

  it("derives inverse displayField from the source table instead of reusing the target field", async () => {
    setupTransaction({
      currentFields: [
        { id: "title-1", key: "title", type: "TEXT" },
        { id: "summary-1", key: "summary", type: "TEXT" },
      ],
    });

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
    expect(dbMock.dataField.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          tableId: "author_table_id",
          relationTo: "paper_table_id",
          displayField: "title",
        }),
      })
    );
  });

  it.each([
    { field: "required", value: true, error: "RELATION_FIELD_LOCKED" },
    { field: "defaultValue", value: "changed", error: "RELATION_FIELD_LOCKED" },
    { field: "sortOrder", value: 9, error: "RELATION_FIELD_LOCKED" },
  ])("rejects changes to existing relation field %s", async ({ field, value, error }) => {
    setupTransaction({
      currentFields: [buildFieldRow({ inverseFieldId: "inverse-1" })],
    });

    const input: Record<string, unknown> = {
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
      defaultValue: null,
      options: null,
    };
    input[field] = value;

    const result = await saveTableFieldsWithRelations({
      tableId: "paper_table_id",
      fields: [input as never],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(error);
    }
  });

  it("rejects changing inverseFieldId on an existing relation field", async () => {
    setupTransaction({
      currentFields: [buildFieldRow({ inverseFieldId: "inverse-1" })],
    });

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
          inverseFieldId: "inverse-2",
          sortOrder: 0,
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("RELATION_FIELD_LOCKED");
    }
  });
});
