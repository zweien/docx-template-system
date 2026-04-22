import { describe, expect, it } from "vitest";
import {
  findFirstConflictTaskId,
  shouldWarnConflictGrowth,
} from "./timeline-view-helpers";
import type { TimelineLink } from "./timeline-adapter";

describe("timeline-view helpers", () => {
  describe("shouldWarnConflictGrowth", () => {
    it("依赖加载中不提示", () => {
      expect(
        shouldWarnConflictGrowth({
          previousCount: 1,
          currentCount: 2,
          isDependencyLoading: true,
        })
      ).toBe(false);
    });

    it("首次加载前一值为空不提示", () => {
      expect(
        shouldWarnConflictGrowth({
          previousCount: null,
          currentCount: 2,
          isDependencyLoading: false,
        })
      ).toBe(false);
    });

    it("冲突数增长时提示", () => {
      expect(
        shouldWarnConflictGrowth({
          previousCount: 1,
          currentCount: 2,
          isDependencyLoading: false,
        })
      ).toBe(true);
    });

    it("冲突数不增长时不提示", () => {
      expect(
        shouldWarnConflictGrowth({
          previousCount: 2,
          currentCount: 2,
          isDependencyLoading: false,
        })
      ).toBe(false);
      expect(
        shouldWarnConflictGrowth({
          previousCount: 3,
          currentCount: 1,
          isDependencyLoading: false,
        })
      ).toBe(false);
    });
  });

  describe("findFirstConflictTaskId", () => {
    const links: TimelineLink[] = [
      {
        id: "l1",
        dependencyId: "dep-1",
        predecessorTaskId: "task-a",
        successorTaskId: "task-b",
        type: "FS",
        lagDays: 0,
        required: true,
      },
      {
        id: "l2",
        dependencyId: "dep-2",
        predecessorTaskId: "task-c",
        successorTaskId: "task-d",
        type: "FS",
        lagDays: 0,
        required: true,
      },
    ];

    it("返回首个冲突依赖对应的后继任务 id", () => {
      expect(
        findFirstConflictTaskId({
          conflictDependencyIds: ["dep-2", "dep-1"],
          links,
        })
      ).toBe("task-d");
    });

    it("无冲突时返回 null", () => {
      expect(
        findFirstConflictTaskId({
          conflictDependencyIds: [],
          links,
        })
      ).toBeNull();
    });

    it("冲突依赖不存在时返回 null", () => {
      expect(
        findFirstConflictTaskId({
          conflictDependencyIds: ["dep-x"],
          links,
        })
      ).toBeNull();
    });
  });
});
