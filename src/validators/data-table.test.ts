import { describe, expect, it } from "vitest";
import { viewTypeNameSchema } from "@/validators/data-table";

describe("viewTypeNameSchema", () => {
  it("应允许保存日历视图类型", () => {
    expect(viewTypeNameSchema.parse("CALENDAR")).toBe("CALENDAR");
  });
});
