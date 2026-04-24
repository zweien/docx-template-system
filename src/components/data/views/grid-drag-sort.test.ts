import { describe, expect, it } from "vitest";
import { buildInsertedRecordOrder, getDragSortState } from "@/components/data/views/grid-drag-sort";

describe("getDragSortState", () => {
  it("管理员在普通视图中可拖拽排序", () => {
    expect(
      getDragSortState({
        isAdmin: true,
        hasActiveSorts: false,
        hasGroupBy: false,
      })
    ).toEqual({
      enabled: true,
      title: "拖动排序",
    });
  });

  it("无视图时仍可拖拽排序", () => {
    expect(
      getDragSortState({
        isAdmin: true,
        hasActiveSorts: false,
        hasGroupBy: false,
      })
    ).toEqual({
      enabled: true,
      title: "拖动排序",
    });
  });

  it("排序和分组都会阻止拖拽排序", () => {
    expect(
      getDragSortState({
        isAdmin: true,
        hasActiveSorts: true,
        hasGroupBy: true,
      })
    ).toEqual({
      enabled: false,
      title: "清除当前排序并取消分组后可拖动排序",
    });
  });
});

describe("buildInsertedRecordOrder", () => {
  it("支持插入到参考行上方", () => {
    expect(
      buildInsertedRecordOrder(["r1", "r2", "r3"], "r2", "above", "r-new")
    ).toEqual(["r1", "r-new", "r2", "r3"]);
  });

  it("支持插入到参考行下方", () => {
    expect(
      buildInsertedRecordOrder(["r1", "r2", "r3"], "r2", "below", "r-new")
    ).toEqual(["r1", "r2", "r-new", "r3"]);
  });

  it("参考行不存在时返回 null", () => {
    expect(
      buildInsertedRecordOrder(["r1", "r2"], "missing", "below", "r-new")
    ).toBeNull();
  });
});
