import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/components/layout/navigation/schema";

describe("navigation integration", () => {
  it("桌面与移动导航共享同一主导航顺序", () => {
    const mainItems = NAV_ITEMS
      .filter((item) => item.section === "main")
      .sort((a, b) => a.order - b.order);

    expect(mainItems.map((item) => item.href)).toEqual([
      "/",
      "/generate",
      "/records",
      "/drafts",
      "/templates",
      "/data",
      "/collections",
      "/ai-agent2",
    ]);
  });
});
