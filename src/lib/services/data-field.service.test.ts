import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DataFieldInput } from "@/validators/data-table";
import { saveTableFieldsWithRelations } from "./data-field.service";

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  dataTable: {
    findUnique: vi.fn(),
  },
  dataField: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

function buildCurrentField(overrides: Record<string, unknown> = {}) {
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
    inverseFieldId: "inverse-1",
    isSystemManagedInverse: false,
    relationSchema: null,
    defaultValue: null,
    sortOrder: 0,
    inverseField: {
      id: "inverse-1",
      relationCardinality: "MULTIPLE",
    },
    ...overrides,
  };
}

function buildTextField(key: string) {
  return { id: `${key}-id`, key, type: "TEXT" };
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
  dbMock.dataField.findUnique.mockResolvedValue(null);
  dbMock.dataField.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: `created-${dbMock.dataField.create.mock.calls.length}`,
    ...data,
  }));
  dbMock.dataField.update.mockResolvedValue({ id: "updated-1" });
  dbMock.dataField.deleteMany.mockResolvedValue({ count: 0 });
}

function buildRelationInput(overrides: Partial<DataFieldInput> = {}): DataFieldInput {
  return {
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
    ...overrides,
  } as DataFieldInput;
}

describe("saveTableFieldsWithRelations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates forward and inverse relation subtable fields as a locked pair", async () => {
    setupTransaction({
      currentFields: [buildTextField("title"), buildTextField("summary")],
    });

    const result = await saveTableFieldsWithRelations({
      tableId: "paper_table_id",
      fields: [
        buildTextField("title") as never,
        buildRelationInput({ inverseRelationCardinality: "MULTIPLE" }),
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
          relationCardinality: "MULTIPLE",
          displayField: "title",
          isSystemManagedInverse: true,
        }),
      })
    );
  });

  it("creates SINGLE to SINGLE as a one-to-one relation pair", async () => {
    setupTransaction({
      currentFields: [buildTextField("title")],
    });

    const result = await saveTableFieldsWithRelations({
      tableId: "paper_table_id",
      fields: [buildRelationInput({ inverseRelationCardinality: "SINGLE" })],
    });

    expect(result.success).toBe(true);
    expect(dbMock.dataField.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          relationCardinality: "SINGLE",
        }),
      })
    );
  });

  it("rejects MULTIPLE with inverse SINGLE", async () => {
    setupTransaction({
      currentFields: [buildTextField("title")],
    });

    const result = await saveTableFieldsWithRelations({
      tableId: "paper_table_id",
      fields: [
        buildRelationInput({
          relationCardinality: "MULTIPLE",
          inverseRelationCardinality: "SINGLE",
        }),
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INVERSE_RELATION_CARDINALITY");
    }
  });

  it("derives inverse displayField from the source table instead of reusing the target field", async () => {
    setupTransaction({
      currentFields: [buildTextField("title"), buildTextField("summary")],
    });

    const result = await saveTableFieldsWithRelations({
      tableId: "paper_table_id",
      fields: [
        buildTextField("title") as never,
        buildRelationInput({ inverseRelationCardinality: "MULTIPLE" }),
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

  it("creates inverse displayField from newly added source fields in the same save batch", async () => {
    setupTransaction({
      currentFields: [],
    });

    const result = await saveTableFieldsWithRelations({
      tableId: "paper_table_id",
      fields: [
        buildTextField("title") as never,
        buildRelationInput({ inverseRelationCardinality: "MULTIPLE" }),
      ],
    });

    expect(result.success).toBe(true);
    expect(dbMock.dataField.create).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({
          tableId: "author_table_id",
          relationTo: "paper_table_id",
          displayField: "title",
        }),
      })
    );
  });

  it("ignores deleted source fields when choosing inverse displayField", async () => {
    setupTransaction({
      currentFields: [buildTextField("title"), buildTextField("summary")],
    });

    const result = await saveTableFieldsWithRelations({
      tableId: "paper_table_id",
      fields: [
        buildTextField("name") as never,
        buildRelationInput({ inverseRelationCardinality: "MULTIPLE" }),
      ],
    });

    expect(result.success).toBe(true);
    expect(dbMock.dataField.create).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({
          tableId: "author_table_id",
          relationTo: "paper_table_id",
          displayField: "name",
        }),
      })
    );
    expect(dbMock.dataField.deleteMany).toHaveBeenCalledWith({ where: { id: "title-id" } });
  });

  it.each([
    { field: "required", value: true },
    { field: "defaultValue", value: "changed" },
    { field: "sortOrder", value: 9 },
  ])("rejects changes to existing relation field %s", async ({ field, value }) => {
    setupTransaction({
      currentFields: [buildCurrentField()],
    });

    const input: Record<string, unknown> = buildRelationInput({
      relationCardinality: "MULTIPLE",
      inverseRelationCardinality: "MULTIPLE",
      defaultValue: null,
      options: null,
    });
    input[field] = value;

    const result = await saveTableFieldsWithRelations({
      tableId: "paper_table_id",
      fields: [input as never],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("RELATION_FIELD_LOCKED");
    }
  });

  it("rejects changing inverseFieldId on an existing relation field", async () => {
    setupTransaction({
      currentFields: [buildCurrentField()],
    });

    const result = await saveTableFieldsWithRelations({
      tableId: "paper_table_id",
      fields: [
        buildRelationInput({
          relationCardinality: "MULTIPLE",
          inverseRelationCardinality: "MULTIPLE",
          inverseFieldId: "inverse-2",
        }),
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("RELATION_FIELD_LOCKED");
    }
  });

  it("syncs inverse field updates when a forward relation field changes", async () => {
    setupTransaction({
      currentFields: [buildCurrentField()],
    });
    dbMock.dataField.findUnique.mockResolvedValue({
      id: "inverse-1",
      tableId: "author_table_id",
      key: "authors_inverse",
      label: "作者（反向）",
      type: "RELATION_SUBTABLE",
      required: false,
      options: null,
      relationTo: "paper_table_id",
      displayField: "title",
      relationCardinality: "MULTIPLE",
      inverseFieldId: "field-1",
      isSystemManagedInverse: true,
      relationSchema: null,
      defaultValue: null,
      sortOrder: 0,
      inverseField: null,
    });

    const result = await saveTableFieldsWithRelations({
      tableId: "paper_table_id",
      fields: [
        buildRelationInput({
          relationCardinality: "MULTIPLE",
          inverseRelationCardinality: "MULTIPLE",
          displayField: "summary",
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
              {
                key: "contribution",
                label: "贡献",
                type: "TEXT" as never,
                required: false,
                sortOrder: 1,
              },
            ],
          },
        }),
      ],
    });

    expect(result.success).toBe(true);
    expect(dbMock.dataField.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inverse-1" },
        data: expect.objectContaining({
          relationCardinality: "MULTIPLE",
          displayField: "summary",
          relationSchema: {
            version: 1,
            fields: expect.arrayContaining([
              expect.objectContaining({ key: "author_order" }),
              expect.objectContaining({ key: "contribution" }),
            ]),
          },
        }),
      })
    );
  });

  it("allows updating an existing relation field without resending inverse lock fields", async () => {
    setupTransaction({
      currentFields: [buildCurrentField()],
    });
    dbMock.dataField.findUnique.mockResolvedValue({
      id: "inverse-1",
      tableId: "author_table_id",
      key: "authors_inverse",
      label: "作者（反向）",
      type: "RELATION_SUBTABLE",
      required: false,
      options: null,
      relationTo: "paper_table_id",
      displayField: "title",
      relationCardinality: "MULTIPLE",
      inverseFieldId: "field-1",
      isSystemManagedInverse: true,
      relationSchema: null,
      defaultValue: null,
      sortOrder: 0,
      inverseField: null,
    });

    const input = buildRelationInput({
      relationCardinality: "MULTIPLE",
    });
    delete (input as Record<string, unknown>).inverseRelationCardinality;
    delete (input as Record<string, unknown>).inverseFieldId;

    const result = await saveTableFieldsWithRelations({
      tableId: "paper_table_id",
      fields: [input],
    });

    expect(result.success).toBe(true);
  });

  it("rejects tampering inverseRelationCardinality on an existing relation field", async () => {
    setupTransaction({
      currentFields: [buildCurrentField({ inverseField: { id: "inverse-1", relationCardinality: "MULTIPLE" } })],
    });

    const result = await saveTableFieldsWithRelations({
      tableId: "paper_table_id",
      fields: [
        buildRelationInput({
          relationCardinality: "MULTIPLE",
          inverseRelationCardinality: "SINGLE",
        }),
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INVERSE_RELATION_CARDINALITY");
    }
  });
});
