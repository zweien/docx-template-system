"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CopyToDraftButtonProps {
  recordId: string;
}

export function CopyToDraftButton({ recordId }: CopyToDraftButtonProps) {
  const [copying, setCopying] = useState(false);
  const router = useRouter();

  const handleCopy = async () => {
    setCopying(true);
    try {
      const res = await fetch(`/api/records/${recordId}/copy`, {
        method: "POST",
      });

      if (res.ok) {
        toast.success("已复制为新草稿");
        router.push("/drafts");
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error?.message || "复制失败");
      }
    } catch {
      toast.error("请求失败，请重试");
    } finally {
      setCopying(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleCopy} disabled={copying}>
      {copying ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {copying ? "复制中..." : "复制为新草稿"}
    </Button>
  );
}
