"use client";

import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TemplateDownloadButton({
  templateId,
}: {
  templateId: string;
}) {
  return (
    <a
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "mt-1 inline-flex no-underline"
      )}
      href={`/api/templates/${templateId}/download`}
      download
    >
      <Download className="h-4 w-4" />
      下载模板
    </a>
  );
}
