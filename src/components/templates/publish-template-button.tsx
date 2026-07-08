"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 发布模板按钮（用于 DOWNLOAD 型等不走 wizard 的模板）。
 * 点击后调用 /api/templates/[id]/publish 并刷新页面。
 */
export function PublishTemplateButton({ templateId }: { templateId: string }) {
  const [publishing, setPublishing] = useState(false);
  const router = useRouter();

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/templates/${templateId}/publish`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error?.message || "发布失败");
        return;
      }
      toast.success("版本发布成功");
      router.refresh();
    } catch {
      toast.error("发布失败，请重试");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handlePublish}
      disabled={publishing}
      className="gap-1.5"
    >
      {publishing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Check className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">
        {publishing ? "发布中..." : "发布"}
      </span>
    </Button>
  );
}
