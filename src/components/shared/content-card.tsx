import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ContentCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function ContentCard({ children, className, hover }: ContentCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-6",
        hover && "transition-colors hover:border-border-hover hover:bg-surface-hover",
        className
      )}
    >
      {children}
    </div>
  );
}
