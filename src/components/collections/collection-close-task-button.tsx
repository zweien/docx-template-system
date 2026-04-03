"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CollectionCloseTaskButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleCloseTask() {
    setSubmitting(true);

    try {
      const response = await fetch(`/api/collections/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "close" }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: { message?: string } };
        throw new Error(payload.error?.message ?? "关闭任务失败");
      }

      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleCloseTask} disabled={submitting}>
      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      关闭任务
    </Button>
  );
}
