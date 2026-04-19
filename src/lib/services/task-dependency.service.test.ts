import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteTaskDependency,
  listTaskDependencies,
  upsertTaskDependency,
} from "./task-dependency.service";

type MockDataRecord = {
  id: string;
  tableId: string;
};

type MockTaskDependency = {
  id: string;
  tableId: string;
  successorRecordId: string;
  predecessorRecordId: string;
  type: "FS";
  lagDays: number;
  required: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const store = vi.hoisted(() => ({
  records: [] as MockDataRecord[],
  dependencies: [] as MockTaskDependency[],
  seq: 1,
}));

const dbMock = vi.hoisted(() => ({
  dataRecord: {
    findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => {
      const ids = new Set(where.id.in);
      return store.records.filter((record) => ids.has(record.id));
    }),
  },
  taskDependency: {
    findMany: vi.fn(async ({ where }: { where: { tableId: string } }) =>
      store.dependencies
        .filter((item) => item.tableId === where.tableId)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    ),
    upsert: vi.fn(async ({
      where,
      update,
      create,
    }: {
      where: {
        successorRecordId_predecessorRecordId_type: {
          successorRecordId: string;
          predecessorRecordId: string;
          type: "FS";
        };
      };
      update: {
        tableId: string;
        lagDays: number;
        required: boolean;
      };
      create: {
        tableId: string;
        successorRecordId: string;
        predecessorRecordId: string;
        type: "FS";
        lagDays: number;
        required: boolean;
      };
    }) => {
      const composite = where.successorRecordId_predecessorRecordId_type;
      const existing = store.dependencies.find((item) => (
        item.successorRecordId === composite.successorRecordId &&
        item.predecessorRecordId === composite.predecessorRecordId &&
        item.type === composite.type
      ));

      if (existing) {
        existing.tableId = update.tableId;
        existing.lagDays = update.lagDays;
        existing.required = update.required;
        existing.updatedAt = new Date("2026-04-19T00:00:00.000Z");
        return { ...existing };
      }

      const row: MockTaskDependency = {
        id: `dep-${store.seq++}`,
        ...create,
        createdAt: new Date("2026-04-18T00:00:00.000Z"),
        updatedAt: new Date("2026-04-18T00:00:00.000Z"),
      };
      store.dependencies.push(row);
      return { ...row };
    }),
    deleteMany: vi.fn(async ({ where }: { where: { id: string; tableId: string } }) => {
      const before = store.dependencies.length;
      store.dependencies = store.dependencies.filter((item) => (
        !(item.id === where.id && item.tableId === where.tableId)
      ));
      return { count: before - store.dependencies.length };
    }),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

describe("task-dependency.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.records = [
      { id: "record-1", tableId: "table-1" },
      { id: "record-2", tableId: "table-1" },
      { id: "record-3", tableId: "table-2" },
    ];
    store.dependencies = [];
    store.seq = 1;
  });

  it("listTaskDependencies returns dependencies by table", async () => {
    store.dependencies.push(
      {
        id: "dep-1",
        tableId: "table-1",
        successorRecordId: "record-1",
        predecessorRecordId: "record-2",
        type: "FS",
        lagDays: 0,
        required: true,
        createdAt: new Date("2026-04-18T00:00:00.000Z"),
        updatedAt: new Date("2026-04-18T00:00:00.000Z"),
      },
      {
        id: "dep-2",
        tableId: "table-2",
        successorRecordId: "record-3",
        predecessorRecordId: "record-1",
        type: "FS",
        lagDays: 1,
        required: false,
        createdAt: new Date("2026-04-18T00:01:00.000Z"),
        updatedAt: new Date("2026-04-18T00:01:00.000Z"),
      }
    );

    const result = await listTaskDependencies("table-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: "dep-1",
        tableId: "table-1",
        type: "FS",
      });
    }
  });

  it("upsertTaskDependency creates dependency", async () => {
    const result = await upsertTaskDependency({
      tableId: "table-1",
      successorRecordId: "record-1",
      predecessorRecordId: "record-2",
      type: "FS",
      lagDays: 2,
      required: true,
    });

    expect(result.success).toBe(true);
    expect(store.dependencies).toHaveLength(1);
    expect(store.dependencies[0]).toMatchObject({
      successorRecordId: "record-1",
      predecessorRecordId: "record-2",
      lagDays: 2,
      required: true,
    });
  });

  it("upsertTaskDependency rejects self-loop", async () => {
    const result = await upsertTaskDependency({
      tableId: "table-1",
      successorRecordId: "record-1",
      predecessorRecordId: "record-1",
      type: "FS",
      lagDays: 0,
      required: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("SELF_LOOP");
    }
  });

  it("upsertTaskDependency rejects cross-table dependency", async () => {
    const result = await upsertTaskDependency({
      tableId: "table-1",
      successorRecordId: "record-1",
      predecessorRecordId: "record-3",
      type: "FS",
      lagDays: 0,
      required: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("CROSS_TABLE_DEPENDENCY");
    }
  });

  it("upsertTaskDependency handles duplicate by updating existing row", async () => {
    const first = await upsertTaskDependency({
      tableId: "table-1",
      successorRecordId: "record-1",
      predecessorRecordId: "record-2",
      type: "FS",
      lagDays: 0,
      required: true,
    });

    expect(first.success).toBe(true);

    const second = await upsertTaskDependency({
      tableId: "table-1",
      successorRecordId: "record-1",
      predecessorRecordId: "record-2",
      type: "FS",
      lagDays: 5,
      required: false,
    });

    expect(second.success).toBe(true);
    expect(store.dependencies).toHaveLength(1);
    expect(store.dependencies[0]).toMatchObject({
      lagDays: 5,
      required: false,
    });
  });

  it("deleteTaskDependency removes dependency", async () => {
    store.dependencies.push({
      id: "dep-1",
      tableId: "table-1",
      successorRecordId: "record-1",
      predecessorRecordId: "record-2",
      type: "FS",
      lagDays: 0,
      required: true,
      createdAt: new Date("2026-04-18T00:00:00.000Z"),
      updatedAt: new Date("2026-04-18T00:00:00.000Z"),
    });

    const result = await deleteTaskDependency("table-1", "dep-1");

    expect(result.success).toBe(true);
    expect(store.dependencies).toHaveLength(0);
  });
});
