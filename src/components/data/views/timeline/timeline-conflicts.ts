import type { TimelineLink, TimelineTask } from "./timeline-adapter";

export interface TimelineConflictResult {
  dependencyIds: string[];
  recordIds: string[];
}

function normalizeToStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function calculateTimelineConflicts(
  tasks: TimelineTask[],
  links: TimelineLink[]
): TimelineConflictResult {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const conflictedDependencyIds = new Set<string>();
  const conflictedRecordIds = new Set<string>();

  for (const link of links) {
    if (!link.required || link.type !== "FS") {
      continue;
    }

    const predecessor = taskById.get(link.predecessorTaskId);
    const successor = taskById.get(link.successorTaskId);
    if (!predecessor || !successor) {
      continue;
    }

    const requiredStart = addDays(normalizeToStartOfDay(predecessor.endDate), link.lagDays);
    const actualStart = normalizeToStartOfDay(successor.startDate);

    if (actualStart < requiredStart) {
      conflictedDependencyIds.add(link.dependencyId);
      conflictedRecordIds.add(predecessor.recordId);
      conflictedRecordIds.add(successor.recordId);
    }
  }

  return {
    dependencyIds: [...conflictedDependencyIds].sort(),
    recordIds: [...conflictedRecordIds].sort(),
  };
}
