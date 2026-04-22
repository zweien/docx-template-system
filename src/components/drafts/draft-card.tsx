"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { CalendarDays, FileText, PenLine } from "lucide-react";
import { DeleteDraftButton } from "@/app/(dashboard)/drafts/delete-draft-button";

function formatRelativeTime(date: Date) {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;

  return new Date(date).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getFormDataPreview(formData: Record<string, unknown>): string[] {
  return Object.values(formData)
    .filter((v) => typeof v === "string" && v.trim())
    .slice(0, 3) as string[];
}

interface DraftCardProps {
  id: string;
  templateId: string;
  templateName: string;
  formData: Record<string, unknown>;
  updatedAt: Date;
}

export function DraftCard({ id, templateId, templateName, formData, updatedAt }: DraftCardProps) {
  const router = useRouter();
  const previewValues = getFormDataPreview(formData);
  const editHref = `/templates/${templateId}/fill?draftId=${id}`;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => router.push(editHref)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(editHref);
        }
      }}
      className="h-full cursor-pointer transition-colors hover:border-zinc-400"
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">{templateName}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          {previewValues.map((value, idx) => (
            <p key={idx} className="truncate text-sm text-muted-foreground">
              {value}
            </p>
          ))}
          {previewValues.length === 0 && (
            <p className="text-sm italic text-muted-foreground">（空表单）</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="h-3 w-3" />
          {formatRelativeTime(updatedAt)}
        </div>

        <div className="flex items-center gap-2 pt-1" onClick={(event) => event.stopPropagation()}>
          <LinkButton size="sm" href={editHref}>
            <PenLine className="h-4 w-4" />
            继续编辑
          </LinkButton>
          <DeleteDraftButton draftId={id} draftName={templateName} />
        </div>
      </CardContent>
    </Card>
  );
}
