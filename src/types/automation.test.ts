import { describe, expect, it } from "vitest";
import type { AutomationDefinition } from "@/types/automation";

describe("automation definition types", () => {
  it("supports a constrained trigger -> condition -> branch action shape", () => {
    const definition: AutomationDefinition = {
      version: 1,
      canvas: {
        nodes: [
          { id: "trigger-1", type: "trigger", x: 80, y: 120 },
          { id: "condition-1", type: "condition", x: 320, y: 120 },
          { id: "action-then-1", type: "action", x: 580, y: 60 },
          { id: "action-else-1", type: "action", x: 580, y: 180 },
        ],
        edges: [
          { source: "trigger-1", target: "condition-1" },
          { source: "condition-1", target: "action-then-1", handle: "then" },
          { source: "condition-1", target: "action-else-1", handle: "else" },
        ],
      },
      trigger: { type: "record_created" },
      condition: null,
      thenActions: [
        {
          id: "action-then-1",
          type: "add_comment",
          target: "current_record",
          content: "created",
        },
      ],
      elseActions: [],
    };

    expect(definition.version).toBe(1);
    expect(definition.thenActions).toHaveLength(1);
  });
});
