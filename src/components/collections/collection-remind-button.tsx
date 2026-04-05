"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function CollectionRemindButton({ taskId }: { taskId: string }) {
  const [loading, setLoading] = useState(false);

  const handleRemind = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/collections/${taskId}/remind`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        if (data.data.remindedCount === 0) {
          toast.info("所有参与人已提交，无需催办");
        } else {
          toast.success(`已催办 ${data.data.remindedCount} 位未提交人`);
        }
      } else {
        toast.error(data.error?.message ?? "催办失败");
      }
    } catch {
      toast.error("催办失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" onClick={handleRemind} disabled={loading} variant="default" size="sm">
      <BellRing className="h-4 w-4" />
      {loading ? "催办中..." : "催办未提交人"}
    </Button>
  );
}
