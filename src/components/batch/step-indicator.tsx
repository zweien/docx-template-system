"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  current: number;
  total: number;
  labels?: string[];
}

const DEFAULT_LABELS = ["选择数据源", "字段映射", "生成设置", "执行结果"];

export function StepIndicator({ current, total, labels = DEFAULT_LABELS }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < current;
        const isCurrent = stepNumber === current;

        return (
          <div key={stepNumber} className="flex items-center">
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
                isCompleted && "bg-primary text-primary-foreground",
                isCurrent && "bg-primary text-primary-foreground",
                !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
              )}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : stepNumber}
            </div>
            <span
              className={cn(
                "ml-2 text-sm hidden sm:inline",
                isCurrent ? "text-foreground font-medium" : "text-muted-foreground"
              )}
            >
              {labels[index]}
            </span>
            {index < total - 1 && (
              <div
                className={cn(
                  "w-8 sm:w-16 h-0.5 mx-2",
                  stepNumber < current ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
