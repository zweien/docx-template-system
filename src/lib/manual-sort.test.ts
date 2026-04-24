import { describe, expect, it } from "vitest";
import { parseManualSortOrders } from "@/lib/manual-sort";

describe("parseManualSortOrders", () => {
  it("解析有效的手动排序配置", () => {
    expect(
      parseManualSortOrders({
        manualSort: {
          enabled: true,
          orders: {
            r1: 0,
            r2: "1000",
          },
        },
      })
    ).toEqual({
      r1: 0,
      r2: 1000,
    });
  });

  it("忽略禁用或无效配置", () => {
    expect(
      parseManualSortOrders({
        manualSort: {
          enabled: false,
          orders: {
            r1: 0,
          },
        },
      })
    ).toBeNull();

    expect(parseManualSortOrders({ manualSort: { enabled: true, orders: null } })).toBeNull();
    expect(parseManualSortOrders(null)).toBeNull();
  });
});
