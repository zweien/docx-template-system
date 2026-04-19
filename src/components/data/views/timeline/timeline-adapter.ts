import type { DataFieldItem, DataRecordItem } from "@/types/data-table";

export type TimelineDependencyType = "FS";

export interface TimelineDependencyInput {
  id: string;
  predecessorRecordId: string;
  successorRecordId: string;
  type?: TimelineDependencyType;
  lagDays?: number;
  required?: boolean;
}

export interface TimelineAdapterConfig {
  startFieldKey: string;
  endFieldKey?: string | null;
  labelFieldKey: string;
  milestoneFieldKey?: string | null;
}

export interface TimelineTask {
  id: string;
  recordId: string;
  label: string;
  startDate: Date;
  endDate: Date;
  isMilestone: boolean;
  record: DataRecordItem;
}

export interface TimelineLink {
  id: string;
  dependencyId: string;
  predecessorTaskId: string;
  successorTaskId: string;
  type: TimelineDependencyType;
  lagDays: number;
  required: boolean;
}

export interface TimelineGraph {
  tasks: TimelineTask[];
  links: TimelineLink[];
}

interface BuildTimelineGraphInput {
  records: DataRecordItem[];
  fields: DataFieldItem[];
  dependencies: TimelineDependencyInput[];
  config: TimelineAdapterConfig;
}

function toValidDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  const plainDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (plainDate) {
    const year = Number(plainDate[1]);
    const month = Number(plainDate[2]) - 1;
    const day = Number(plainDate[3]);
    const parsed = new Date(year, month, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return false;

  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "y";
}

function toLagDays(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function buildTimelineGraph({
  records,
  fields,
  dependencies,
  config,
}: BuildTimelineGraphInput): TimelineGraph {
  const fieldByKey = new Map(fields.map((field) => [field.key, field]));
  const startField = fieldByKey.get(config.startFieldKey);
  const labelField = fieldByKey.get(config.labelFieldKey);

  if (!startField || startField.type !== "DATE" || !labelField) {
    return { tasks: [], links: [] };
  }

  const endFieldKey = config.endFieldKey ?? null;
  const milestoneFieldKey = config.milestoneFieldKey ?? null;

  const tasks = records
    .map<TimelineTask | null>((record) => {
      const startDate = toValidDate(record.data[config.startFieldKey]);
      if (!startDate) return null;

      const parsedEndDate = endFieldKey ? toValidDate(record.data[endFieldKey]) : null;
      const endDate = parsedEndDate ?? startDate;

      return {
        id: record.id,
        recordId: record.id,
        label: String(record.data[config.labelFieldKey] ?? record.id),
        startDate,
        endDate,
        isMilestone: milestoneFieldKey ? toBoolean(record.data[milestoneFieldKey]) : false,
        record,
      };
    })
    .filter((task): task is TimelineTask => task !== null)
    .sort((left, right) => {
      const timeDelta = left.startDate.getTime() - right.startDate.getTime();
      if (timeDelta !== 0) return timeDelta;
      return left.recordId.localeCompare(right.recordId);
    });

  const taskIds = new Set(tasks.map((task) => task.id));

  const links = dependencies
    .map<TimelineLink | null>((dependency) => {
      if (!taskIds.has(dependency.predecessorRecordId) || !taskIds.has(dependency.successorRecordId)) {
        return null;
      }

      return {
        id: dependency.id,
        dependencyId: dependency.id,
        predecessorTaskId: dependency.predecessorRecordId,
        successorTaskId: dependency.successorRecordId,
        type: dependency.type ?? "FS",
        lagDays: toLagDays(dependency.lagDays),
        required: dependency.required ?? true,
      };
    })
    .filter((link): link is TimelineLink => link !== null);

  return { tasks, links };
}
