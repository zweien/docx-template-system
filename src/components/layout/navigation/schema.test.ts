import { describe, expect, it } from "vitest";
import { House } from "lucide-react";
import type { NavItem } from "./schema";
import { NAV_ITEMS, filterNavItemsByRole } from "./schema";

describe("navigation schema", () => {
  it("按定义顺序导出导航项，并包含单一导航源所需字段", () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([
      "/",
      "/generate",
      "/records",
      "/drafts",
      "/templates",
      "/data",
      "/collections",
      "/ai-agent2",
      "/admin/settings",
      "/admin/users",
      "/admin/audit-logs",
    ]);

    expect(NAV_ITEMS[0]).toEqual(
      expect.objectContaining({
        id: "home",
        icon: House,
        section: "main",
      })
    );
  });

  it("未提供角色时仅返回公共项", () => {
    expect(filterNavItemsByRole(NAV_ITEMS).map((item) => item.href)).toEqual([
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

  it("会先过滤再按 order 排序，而不是依赖输入顺序", () => {
    const unorderedItems = [
      { id: "admin-users", icon: House, href: "/admin/users", label: "用户管理", section: "admin", order: 3, roles: ["ADMIN"] },
      { id: "generate", icon: House, href: "/generate", label: "生成", section: "main", order: 1 },
      { id: "home", icon: House, href: "/", label: "首页", section: "main", order: 0 },
      { id: "admin-settings", icon: House, href: "/admin/settings", label: "系统设置", section: "admin", order: 2, roles: ["ADMIN"] },
    ] as const satisfies readonly NavItem[];

    expect(filterNavItemsByRole(unorderedItems).map((item) => item.href)).toEqual(["/", "/generate"]);
    expect(filterNavItemsByRole(unorderedItems, "ADMIN").map((item) => item.href)).toEqual([
      "/",
      "/generate",
      "/admin/settings",
      "/admin/users",
    ]);
  });
});
