import { Skeleton } from "@/components/ui/skeleton";

export function DataTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="flex gap-0 border-b border-border pb-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1 mx-1" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-0 py-2 border-b border-border/30">
          {Array.from({ length: 8 }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1 mx-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ReportEditorSkeleton() {
  return (
    <div className="flex gap-0 h-[calc(100vh-3.5rem)]">
      <div className="w-64 border-r border-border/50 p-4 space-y-2">
        <Skeleton className="h-5 w-20" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
        <div className="mt-6 space-y-1">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export function AiAgentSkeleton() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className="w-72 border-r border-border/50 p-3 space-y-1">
        <Skeleton className="h-8 w-full mb-3" />
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-6 space-y-4">
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-16 w-3/5 rounded-lg" />
          </div>
          <div className="flex gap-3 justify-end">
            <Skeleton className="h-12 w-2/5 rounded-lg" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-20 w-3/5 rounded-lg" />
          </div>
        </div>
        <div className="border-t border-border/50 p-4">
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
