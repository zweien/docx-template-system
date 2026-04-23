import { describe, expect, it } from "vitest";
import { getRowHeightClasses } from "@/components/data/views/grid-row-height";

describe("getRowHeightClasses", () => {
  it.each([
    [24, 24],
    [32, 32],
    [40, 40],
    [56, 56],
  ])("将 %ipx 行高选项映射为明确的实际渲染高度", (input, height) => {
    expect(getRowHeightClasses(input).height).toBe(height);
  });
});
