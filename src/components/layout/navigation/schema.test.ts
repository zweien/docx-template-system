import { describe, expect, it } from "vitest";
import { House } from "lucide-react";
import type { NavItem } from "./schema";
import { NAV_ITEMS, NAV_ENTRIES, ADMIN_NAV_ITEMS, FOOTER_NAV_ITEMS, filterEntriesByRole, filterNavItemsByRole } from "./schema";

describe("navigation schema", () => {
  it("NAV_ITEMS 包含所有导航项（向后兼容平铺结构）", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);

    // Home
    expect(hrefs).toContain("/");
    // Template & Form group
    expect(hrefs).toContain("/templates");
    expect(hrefs).toContain("/generate");
    expect(hrefs).toContain("/records");
    expect(hrefs).toContain("/drafts");
    // Data group
    expect(hrefs).toContain("/data");
    // Report group
    expect(hrefs).toContain("/reports/drafts");
    expect(hrefs).toContain("/reports/templates");
    expect(hrefs).toContain("/budget");
    // Standalone tools
    expect(hrefs).toContain("/automations");
    expect(hrefs).toContain("/collections");
    expect(hrefs).toContain("/ai-agent2");
    // Admin
    expect(hrefs).toContain("/admin/settings");
    expect(hrefs).toContain("/admin/editor-ai");
    expect(hrefs).toContain("/admin/users");
    expect(hrefs).toContain("/admin/audit-logs");
    // Footer
    expect(hrefs).toContain("/about");
  });

  it("NAV_ITEMS 首项为首页", () => {
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
      "/about",
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

  it("NAV_ENTRIES 包含分组和独立项", () => {
    expect(NAV_ENTRIES).toHaveLength(7);
    expect(NAV_ENTRIES[0]).toEqual({ type: "item", item: expect.objectContaining({ id: "home" }) });
    expect(NAV_ENTRIES[1]).toEqual({ type: "group", group: expect.objectContaining({ id: "templates-forms" }) });
    expect(NAV_ENTRIES[2]).toEqual({ type: "group", group: expect.objectContaining({ id: "data" }) });
    expect(NAV_ENTRIES[3]).toEqual({ type: "group", group: expect.objectContaining({ id: "reports" }) });
  });

  it("ADMIN_NAV_ITEMS 包含管理员专属导航项", () => {
    expect(ADMIN_NAV_ITEMS.map((item) => item.href)).toEqual([
      "/admin/settings",
      "/admin/editor-ai",
      "/admin/users",
      "/admin/audit-logs",
    ]);
  });

  it("FOOTER_NAV_ITEMS 包含页脚导航项", () => {
    expect(FOOTER_NAV_ITEMS.map((item) => item.href)).toEqual(["/about"]);
  });

  it("filterEntriesByRole 过滤分组和独立项", () => {
    const filtered = filterEntriesByRole(NAV_ENTRIES);
    // All public entries should be present
    expect(filtered).toHaveLength(7);

    const filteredWithAdmin = filterEntriesByRole(NAV_ENTRIES, "ADMIN");
    expect(filteredWithAdmin).toHaveLength(7);
  });
});
