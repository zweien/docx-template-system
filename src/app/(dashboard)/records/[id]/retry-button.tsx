"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RetryButtonProps {
  recordId: string;
}

export function RetryButton({ recordId }: RetryButtonProps) {
  const [retrying, setRetrying] = useState(false);
  const router = useRouter();

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/records/${recordId}/generate`, {
        method: "POST",
      });

      if (res.ok) {
        toast.success("重新生成成功");
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error?.message || "重新生成失败");
      }
    } catch {
      toast.error("请求失败，请重试");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleRetry} disabled={retrying}>
      {retrying ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RotateCcw className="h-4 w-4" />
      )}
      {retrying ? "重新生成中..." : "重试"}
    </Button>
  );
}
