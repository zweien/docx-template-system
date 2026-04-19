import { describe, expect, it } from "vitest";
import { isRouteActive } from "./matcher";

describe("isRouteActive", () => {
  it("首页仅精确匹配 /", () => {
    expect(isRouteActive("/", "/")).toBe(true);
    expect(isRouteActive("/", "/generate")).toBe(false);
  });

  it("其他路由支持边界安全前缀匹配", () => {
    expect(isRouteActive("/data", "/data/x")).toBe(true);
    expect(isRouteActive("/data", "/datax")).toBe(false);
  });

  it("兼容尾斜杠", () => {
    expect(isRouteActive("/data", "/data/")).toBe(true);
    expect(isRouteActive("/data/", "/data/x/")).toBe(true);
  });
});
