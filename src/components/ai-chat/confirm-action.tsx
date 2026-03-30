"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface ConfirmActionProps {
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ConfirmAction({ onConfirm, isLoading }: ConfirmActionProps) {
  return (
    <div className="flex justify-center py-4">
      <Button
        onClick={onConfirm}
        disabled={isLoading}
        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
      >
        <CheckCircle2 className="h-4 w-4 mr-2" />
        {isLoading ? "执行中..." : "确认执行"}
      </Button>
    </div>
  );
}