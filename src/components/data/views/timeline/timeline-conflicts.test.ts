import { describe, expect, it } from "vitest";
import type { DataFieldItem, DataRecordItem } from "@/types/data-table";
import { buildTimelineGraph } from "./timeline-adapter";
import { calculateTimelineConflicts } from "./timeline-conflicts";

function createRecord(id: string, data: Record<string, unknown>): DataRecordItem {
  return {
    id,
    tableId: "tbl-1",
    data,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdByName: "tester",
    updatedByName: null,
  };
}

const fields: DataFieldItem[] = [
  {
    id: "f-start",
    key: "start",
    label: "开始",
    type: "DATE" as DataFieldItem["type"],
    required: false,
    sortOrder: 0,
  },
  {
    id: "f-end",
    key: "end",
    label: "结束",
    type: "DATE" as DataFieldItem["type"],
    required: false,
    sortOrder: 1,
  },
  {
    id: "f-label",
    key: "name",
    label: "名称",
    type: "TEXT" as DataFieldItem["type"],
    required: false,
    sortOrder: 2,
  },
  {
    id: "f-milestone",
    key: "isMilestone",
    label: "里程碑",
    type: "BOOLEAN" as DataFieldItem["type"],
    required: false,
    sortOrder: 3,
  },
];

describe("buildTimelineGraph + calculateTimelineConflicts", () => {
  it("支持正 lagDays 冲突判定", () => {
    const graph = buildTimelineGraph({
      records: [
        createRecord("A", { start: "2026-01-01", end: "2026-01-05", name: "A" }),
        createRecord("B", { start: "2026-01-06", end: "2026-01-10", name: "B" }),
      ],
      fields,
      dependencies: [
        {
          id: "dep-positive",
          predecessorRecordId: "A",
          successorRecordId: "B",
          type: "FS",
          lagDays: 2,
          required: true,
        },
      ],
      config: {
        startFieldKey: "start",
        endFieldKey: "end",
        labelFieldKey: "name",
        milestoneFieldKey: "isMilestone",
      },
    });

    const result = calculateTimelineConflicts(graph.tasks, graph.links);

    expect(result.dependencyIds).toEqual(["dep-positive"]);
    expect(result.recordIds).toEqual(["A", "B"]);
  });

  it("支持零 lagDays：同日衔接不冲突", () => {
    const graph = buildTimelineGraph({
      records: [
        createRecord("A", { start: "2026-01-01", end: "2026-01-05", name: "A" }),
        createRecord("B", { start: "2026-01-05", end: "2026-01-08", name: "B" }),
      ],
      fields,
      dependencies: [
        {
          id: "dep-zero",
          predecessorRecordId: "A",
          successorRecordId: "B",
          type: "FS",
          lagDays: 0,
          required: true,
        },
      ],
      config: {
        startFieldKey: "start",
        endFieldKey: "end",
        labelFieldKey: "name",
      },
    });

    const result = calculateTimelineConflicts(graph.tasks, graph.links);

    expect(result.dependencyIds).toEqual([]);
    expect(result.recordIds).toEqual([]);
  });

  it("支持负 lagDays 冲突判定", () => {
    const graph = buildTimelineGraph({
      records: [
        createRecord("A", { start: "2026-01-01", end: "2026-01-10", name: "A" }),
        createRecord("B", { start: "2026-01-07", end: "2026-01-12", name: "B" }),
      ],
      fields,
      dependencies: [
        {
          id: "dep-negative",
          predecessorRecordId: "A",
          successorRecordId: "B",
          type: "FS",
          lagDays: -2,
          required: true,
        },
      ],
      config: {
        startFieldKey: "start",
        endFieldKey: "end",
        labelFieldKey: "name",
      },
    });

    const result = calculateTimelineConflicts(graph.tasks, graph.links);

    expect(result.dependencyIds).toEqual(["dep-negative"]);
    expect(result.recordIds).toEqual(["A", "B"]);
  });

  it("required=false 时不计冲突", () => {
    const graph = buildTimelineGraph({
      records: [
        createRecord("A", { start: "2026-01-01", end: "2026-01-05", name: "A" }),
        createRecord("B", { start: "2026-01-02", end: "2026-01-06", name: "B" }),
      ],
      fields,
      dependencies: [
        {
          id: "dep-optional",
          predecessorRecordId: "A",
          successorRecordId: "B",
          type: "FS",
          lagDays: 3,
          required: false,
        },
      ],
      config: {
        startFieldKey: "start",
        endFieldKey: "end",
        labelFieldKey: "name",
      },
    });

    const result = calculateTimelineConflicts(graph.tasks, graph.links);

    expect(result.dependencyIds).toEqual([]);
    expect(result.recordIds).toEqual([]);
  });

  it("缺失开始日期记录会被 adapter 过滤，相关依赖不会参与冲突", () => {
    const graph = buildTimelineGraph({
      records: [
        createRecord("A", { start: "2026-01-01", end: "2026-01-03", name: "A" }),
        createRecord("B", { end: "2026-01-08", name: "B" }),
      ],
      fields,
      dependencies: [
        {
          id: "dep-missing-date",
          predecessorRecordId: "A",
          successorRecordId: "B",
          type: "FS",
          lagDays: 0,
          required: true,
        },
      ],
      config: {
        startFieldKey: "start",
        endFieldKey: "end",
        labelFieldKey: "name",
      },
    });

    expect(graph.tasks.map((task) => task.recordId)).toEqual(["A"]);
    expect(graph.links).toHaveLength(0);

    const result = calculateTimelineConflicts(graph.tasks, graph.links);
    expect(result.dependencyIds).toEqual([]);
    expect(result.recordIds).toEqual([]);
  });
});
