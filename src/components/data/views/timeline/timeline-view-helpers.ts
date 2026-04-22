import type { TimelineLink } from "./timeline-adapter";

export function shouldWarnConflictGrowth(params: {
  previousCount: number | null;
  currentCount: number;
  isDependencyLoading: boolean;
}): boolean {
  const { previousCount, currentCount, isDependencyLoading } = params;
  if (isDependencyLoading) return false;
  if (previousCount === null) return false;
  return currentCount > previousCount;
}

export function findFirstConflictTaskId(params: {
  conflictDependencyIds: string[];
  links: TimelineLink[];
}): string | null {
  const { conflictDependencyIds, links } = params;
  if (conflictDependencyIds.length === 0) return null;

  const firstDepId = conflictDependencyIds[0];
  const link = links.find((item) => item.dependencyId === firstDepId);
  return link?.successorTaskId ?? link?.predecessorTaskId ?? null;
}
