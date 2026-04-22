import type { AutomationDefinition } from "@/types/automation";

export function createDefaultAutomationDefinition(): AutomationDefinition {
  return {
    version: 1,
    canvas: {
      nodes: [{ id: "trigger-1", type: "trigger", x: 80, y: 120 }],
      edges: [],
    },
    trigger: { type: "manual" },
    condition: null,
    thenActions: [],
    elseActions: [],
  };
}
