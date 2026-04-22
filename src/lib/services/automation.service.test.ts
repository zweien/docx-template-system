import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAutomation, listAutomations } from "./automation.service";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    automation: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

describe("automation.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid canvas topology with two trigger nodes", async () => {
    const result = await createAutomation({
      tableId: "tbl_1",
      userId: "usr_1",
      input: {
        name: "Broken",
        enabled: true,
        triggerType: "record_created",
        definition: {
          version: 1,
          canvas: {
            nodes: [
              { id: "trigger-a", type: "trigger", x: 0, y: 0 },
              { id: "trigger-b", type: "trigger", x: 1, y: 1 },
            ],
            edges: [],
          },
          trigger: { type: "record_created" },
          condition: null,
          thenActions: [],
          elseActions: [],
        },
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_DEFINITION");
    }
    expect(dbMock.automation.create).not.toHaveBeenCalled();
  });

  it("includes latest run summary when listing automations", async () => {
    dbMock.automation.findMany.mockResolvedValue([
      {
        id: "aut_1",
        tableId: "tbl_1",
        name: "Webhook Sync",
        description: "同步外部系统",
        enabled: true,
        triggerType: "record_updated",
        definitionVersion: 1,
        createdById: "usr_1",
        updatedById: "usr_1",
        createdAt: new Date("2026-04-22T00:00:00.000Z"),
        updatedAt: new Date("2026-04-22T01:00:00.000Z"),
        table: { name: "Tasks" },
        runs: [
          {
            id: "run_1",
            status: "SUCCEEDED",
            triggerSource: "EVENT",
            createdAt: new Date("2026-04-22T01:00:00.000Z"),
            finishedAt: new Date("2026-04-22T01:00:00.800Z"),
            durationMs: 800,
            errorMessage: null,
          },
        ],
      },
    ]);

    const result = await listAutomations("usr_1");

    expect(result.success).toBe(true);
    expect(dbMock.automation.findMany).toHaveBeenCalledWith({
      where: { createdById: "usr_1" },
      include: {
        table: {
          select: { name: true },
        },
        runs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            triggerSource: true,
            createdAt: true,
            finishedAt: true,
            durationMs: true,
            errorMessage: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
    if (!result.success) {
      throw new Error("Expected success");
    }
    expect(result.data[0]?.latestRun).toMatchObject({
      id: "run_1",
      status: "SUCCEEDED",
      triggerSource: "EVENT",
      durationMs: 800,
    });
  });
});
