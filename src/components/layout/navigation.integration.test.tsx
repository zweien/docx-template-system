import { describe, expect, it } from "vitest";
import { NAV_ENTRIES, NAV_ITEMS } from "@/components/layout/navigation/schema";

describe("navigation integration", () => {
  it("桌面与移动导航共享同一主导航顺序", () => {
    // Filter for main and reports sections (non-admin, non-footer)
    const navItems = NAV_ITEMS
      .filter((item) => item.section === "main" || item.section === "reports")
      .sort((a, b) => a.order - b.order);

    expect(navItems.map((item) => item.href)).toEqual([
      "/",
      "/templates",
      "/generate",
      "/records",
      "/drafts",
      "/data",
      "/reports/drafts",
      "/reports/templates",
      "/budget",
      "/automations",
      "/collections",
      "/ai-agent2",
    ]);
  });

  it("NAV_ENTRIES 定义了正确的分组结构", () => {
    expect(NAV_ENTRIES).toHaveLength(7);

    // First entry is home item
    expect(NAV_ENTRIES[0].type).toBe("item");

    // Next 3 are groups
    expect(NAV_ENTRIES[1].type).toBe("group");
    expect(NAV_ENTRIES[2].type).toBe("group");
    expect(NAV_ENTRIES[3].type).toBe("group");

    // Last 3 are standalone items
    expect(NAV_ENTRIES[4].type).toBe("item");
    expect(NAV_ENTRIES[5].type).toBe("item");
    expect(NAV_ENTRIES[6].type).toBe("item");
  });
});
