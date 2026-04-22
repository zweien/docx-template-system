import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAutomation } from "./automation.service";

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
});
