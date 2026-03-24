"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface StepNavigationProps {
  current: number;
  total: number;
  canNext: boolean;
  onNext: () => void;
  onPrev: () => void;
  isLoading?: boolean;
  nextLabel?: string;
}

export function StepNavigation({
  current,
  total,
  canNext,
  onNext,
  onPrev,
  isLoading,
  nextLabel,
}: StepNavigationProps) {
  const isLast = current === total;

  return (
    <div className="flex items-center justify-between pt-6 border-t">
      <Button
        variant="outline"
        onClick={onPrev}
        disabled={current === 1 || isLoading}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        上一步
      </Button>

      <Button onClick={onNext} disabled={!canNext || isLoading}>
        {isLoading ? (
          "处理中..."
        ) : (
          <>
            {nextLabel || (isLast ? "完成" : "下一步")}
            <ArrowRight className="h-4 w-4 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
}
