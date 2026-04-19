import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DataFieldItem } from "@/types/data-table";

// ── Mocks ──

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  dataRecord: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

const getTableMock = vi.fn();
const findByUniqueFieldMock = vi.fn();
const createRecordMock = vi.fn();
const updateRecordMock = vi.fn();
const syncRelationMock = vi.fn();

vi.mock("./data-table.service", () => ({
  getTable: getTableMock,
}));

vi.mock("./data-record.service", () => ({
  findByUniqueField: findByUniqueFieldMock,
  createRecord: createRecordMock,
  updateRecord: updateRecordMock,
}));

vi.mock("./data-relation.service", () => ({
  syncRelationSubtableValues: syncRelationMock,
  removeAllRelationsForRecord: vi.fn(),
}));

// Import after mocks are set up
const {
  findRecordByBusinessKey,
  importData,
  importRelationDetails,
} = await import("./import.service");

// ── Helpers ──

function buildField(overrides: Partial<DataFieldItem> = {}): DataFieldItem {
  return {
    id: "f1",
    key: "name",
    label: "名称",
    type: "TEXT",
    required: false,
    sortOrder: 0,
    ...overrides,
  };
}

function buildRelationField(overrides: Partial<DataFieldItem> = {}): DataFieldItem {
  return {
    id: "rel-field-1",
    key: "authors",
    label: "作者",
    type: "RELATION_SUBTABLE",
    required: false,
    relationTo: "author-table-id",
    displayField: "name",
    relationCardinality: "MULTIPLE",
    inverseFieldId: "inv-field-1",
    isSystemManagedInverse: true,
    relationSchema: {
      version: 1,
      fields: [
        { key: "role", label: "角色", type: "TEXT", required: false, sortOrder: 0 },
      ],
    },
    sortOrder: 0,
    ...overrides,
  };
}

// ── findRecordByBusinessKey ──

describe("findRecordByBusinessKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds a record matching all business key values", async () => {
    dbMock.dataRecord.findMany.mockResolvedValue([
      { id: "rec-1", data: { code: "A001", name: "Alpha" } },
    ]);

    const result = await findRecordByBusinessKey("table-1", ["code"], {
      code: "A001",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("rec-1");
    }
  });

  it("finds a record matching multiple business key fields", async () => {
    dbMock.dataRecord.findMany.mockResolvedValue([
      { id: "rec-2", data: { code: "A001", year: 2024 } },
    ]);

    const result = await findRecordByBusinessKey("table-1", ["code", "year"], {
      code: "A001",
      year: 2024,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("rec-2");
    }
  });

  it("returns null when no record matches", async () => {
    dbMock.dataRecord.findMany.mockResolvedValue([]);

    const result = await findRecordByBusinessKey("table-1", ["code"], {
      code: "NOT_FOUND",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  it("returns error when multiple records match", async () => {
    dbMock.dataRecord.findMany.mockResolvedValue([
      { id: "rec-1", data: { code: "DUP" } },
      { id: "rec-2", data: { code: "DUP" } },
    ]);

    const result = await findRecordByBusinessKey("table-1", ["code"], {
      code: "DUP",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("AMBIGUOUS_BUSINESS_KEY");
    }
  });
});

// ── importData with business key upsert ──

describe("importData with business key upsert", () => {
  const fields: DataFieldItem[] = [
    buildField({ key: "code", label: "编号" }),
    buildField({ key: "name", label: "名称" }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    getTableMock.mockResolvedValue({
      success: true,
      data: {
        id: "table-1",
        name: "测试表",
        businessKeys: ["code"],
        fields,
      },
    });
  });

  it("upserts records by business keys", async () => {
    // First row: findRecordByBusinessKey finds existing record
    dbMock.dataRecord.findMany
      .mockResolvedValueOnce([{ id: "existing-1", data: { code: "A001", name: "Old" } }])
      .mockResolvedValueOnce([]); // second row: no match

    updateRecordMock.mockResolvedValue({
      success: true,
      data: { id: "existing-1", data: { code: "A001", name: "Updated" } },
    });
    createRecordMock.mockResolvedValue({
      success: true,
      data: { id: "new-1", data: { code: "A002", name: "New" } },
    });

    const result = await importData(
      "table-1",
      "user-1",
      [
        { 编号: "A001", 名称: "Updated" },
        { 编号: "A002", 名称: "New" },
      ],
      { 编号: "code", 名称: "name" },
      { uniqueField: "code", strategy: "overwrite" },
      fields,
      { businessKeys: ["code"] }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.updated).toBe(1);
      expect(result.data.created).toBe(1);
    }
  });

  it("parses relation subtable JSON from Excel cells", async () => {
    const relationFields = [
      ...fields,
      buildRelationField(),
    ];

    // findRecordByBusinessKey finds no match → create
    dbMock.dataRecord.findMany.mockResolvedValue([]);

    createRecordMock.mockResolvedValue({
      success: true,
      data: { id: "new-1", data: { code: "A001", name: "Test", authors: [] } },
    });

    const result = await importData(
      "table-1",
      "user-1",
      [
        {
          编号: "A001",
          名称: "Test",
          作者: JSON.stringify([
            { targetRecordId: "author-1", attributes: { role: "第一作者" }, sortOrder: 0 },
          ]),
        },
      ],
      { 编号: "code", 名称: "name", 作者: "authors" },
      { uniqueField: "code", strategy: "skip" },
      relationFields,
      { businessKeys: ["code"] }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created).toBe(1);
      const createCall = createRecordMock.mock.calls[0];
      // The relation field value should be parsed from JSON string
      expect(createCall[2].authors).toEqual([
        { targetRecordId: "author-1", attributes: { role: "第一作者" }, sortOrder: 0 },
      ]);
    }
  });
});

// ── importRelationDetails ──

describe("importRelationDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates relation rows from detail table import", async () => {
    // db.$transaction delegates to the callback
    dbMock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(dbMock)
    );

    getTableMock.mockResolvedValue({
      success: true,
      data: {
        id: "paper-table",
        name: "论文",
        businessKeys: ["doi"],
        fields: [
          buildField({ key: "doi", label: "DOI" }),
          buildField({ key: "title", label: "标题" }),
          buildRelationField({
            id: "paper-authors-field",
            key: "authors",
            relationTo: "author-table",
            displayField: "name",
            relationCardinality: "MULTIPLE",
          }),
        ],
      },
    });

    // Source record (paper) found by business key
    dbMock.dataRecord.findMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      const tableId = (where as { tableId?: string }).tableId;
      const andConditions = (where as { AND?: Record<string, unknown>[] }).AND;

      if (tableId === "paper-table") {
        const codeMatch = andConditions?.find((c: Record<string, unknown>) => {
          const data = c.data as { path?: string[]; equals?: unknown } | undefined;
          return data?.path?.[0] === "doi";
        });
        if (codeMatch) {
          const data = (codeMatch as { data: { equals: unknown } }).data;
          if (data.equals === "10.1234/paper1") {
            return [{ id: "paper-1", data: { doi: "10.1234/paper1", title: "论文A" } }];
          }
        }
        return [];
      }

      if (tableId === "author-table") {
        const nameMatch = andConditions?.find((c: Record<string, unknown>) => {
          const data = c.data as { path?: string[]; equals?: unknown } | undefined;
          return data?.path?.[0] === "name";
        });
        if (nameMatch) {
          const data = (nameMatch as { data: { equals: unknown } }).data;
          if (data.equals === "Ada") return [{ id: "author-1", data: { name: "Ada" } }];
          if (data.equals === "Lin") return [{ id: "author-2", data: { name: "Lin" } }];
        }
        return [];
      }

      return [];
    });

    syncRelationMock.mockResolvedValue({ success: true, data: null });

    const result = await importRelationDetails({
      tableId: "paper-table",
      relationFieldKey: "authors",
      userId: "user-1",
      rows: [
        { 论文DOI: "10.1234/paper1", 作者姓名: "Ada", 角色: "第一作者" },
        { 论文DOI: "10.1234/paper1", 作者姓名: "Lin", 角色: "通讯作者" },
      ],
      sourceMapping: { 论文DOI: "doi" },
      targetMapping: { 作者姓名: "name" },
      attributeMapping: { 角色: "role" },
      sourceBusinessKeys: ["doi"],
      targetBusinessKeys: ["name"],
      targetTableId: "author-table",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created).toBe(2);
      expect(syncRelationMock).toHaveBeenCalledTimes(1);
      expect(syncRelationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceRecordId: "paper-1",
          tableId: "paper-table",
        })
      );
    }
  });

  it("rejects relation imports when source business keys match multiple records", async () => {
    getTableMock.mockResolvedValue({
      success: true,
      data: {
        id: "paper-table",
        name: "论文",
        businessKeys: ["doi"],
        fields: [
          buildField({ key: "doi", label: "DOI" }),
          buildRelationField(),
        ],
      },
    });

    dbMock.dataRecord.findMany.mockResolvedValue([
      { id: "paper-1", data: { doi: "10.1234/dup" } },
      { id: "paper-2", data: { doi: "10.1234/dup" } },
    ]);

    const result = await importRelationDetails({
      tableId: "paper-table",
      relationFieldKey: "authors",
      userId: "user-1",
      rows: [
        { 论文DOI: "10.1234/dup", 作者姓名: "Ada", 角色: "作者" },
      ],
      sourceMapping: { 论文DOI: "doi" },
      targetMapping: { 作者姓名: "name" },
      attributeMapping: { 角色: "role" },
      sourceBusinessKeys: ["doi"],
      targetBusinessKeys: ["name"],
      targetTableId: "author-table",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.errors.length).toBeGreaterThan(0);
      expect(result.data.errors[0].message).toContain("匹配到多条");
    }
  });

  it("rejects multiple targets for SINGLE relation fields", async () => {
    getTableMock.mockResolvedValue({
      success: true,
      data: {
        id: "paper-table",
        name: "论文",
        businessKeys: ["doi"],
        fields: [
          buildField({ key: "doi", label: "DOI" }),
          buildRelationField({ relationCardinality: "SINGLE" }),
        ],
      },
    });

    dbMock.dataRecord.findMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      const tableId = (where as { tableId?: string }).tableId;
      const andConditions = (where as { AND?: Record<string, unknown>[] }).AND;

      if (tableId === "paper-table") {
        const doiMatch = andConditions?.find((c: Record<string, unknown>) => {
          const data = c.data as { path?: string[]; equals?: unknown } | undefined;
          return data?.path?.[0] === "doi";
        });
        if (doiMatch) {
          return [{ id: "paper-1", data: { doi: "10.1234/paper1" } }];
        }
      }

      if (tableId === "author-table") {
        const nameMatch = andConditions?.find((c: Record<string, unknown>) => {
          const data = c.data as { path?: string[]; equals?: unknown } | undefined;
          return data?.path?.[0] === "name";
        });
        if (nameMatch) {
          const data = (nameMatch as { data: { equals: unknown } }).data;
          if (data.equals === "Ada") return [{ id: "author-1", data: { name: "Ada" } }];
          if (data.equals === "Lin") return [{ id: "author-2", data: { name: "Lin" } }];
        }
      }

      return [];
    });

    syncRelationMock.mockResolvedValue({
      success: false,
      error: { code: "RELATION_CARDINALITY_VIOLATION", message: "字段 authors 只允许关联 1 条记录" },
    });

    const result = await importRelationDetails({
      tableId: "paper-table",
      relationFieldKey: "authors",
      userId: "user-1",
      rows: [
        { 论文DOI: "10.1234/paper1", 作者姓名: "Ada", 角色: "作者" },
        { 论文DOI: "10.1234/paper1", 作者姓名: "Lin", 角色: "作者" },
      ],
      sourceMapping: { 论文DOI: "doi" },
      targetMapping: { 作者姓名: "name" },
      attributeMapping: { 角色: "role" },
      sourceBusinessKeys: ["doi"],
      targetBusinessKeys: ["name"],
      targetTableId: "author-table",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.errors.length).toBeGreaterThan(0);
    }
  });
});
