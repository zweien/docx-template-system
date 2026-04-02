import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PenLine, CalendarDays, FileText } from "lucide-react";
import { DeleteDraftButton } from "./delete-draft-button";

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;

  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getFormDataPreview(
  formData: Record<string, unknown>
): string[] {
  return Object.values(formData)
    .filter((v) => typeof v === "string" && v.trim())
    .slice(0, 3) as string[];
}

export default async function DraftsPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const drafts = await db.draft.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      template: {
        select: { name: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">我的草稿</h1>
        <p className="text-muted-foreground">
          共 {drafts.length} 个草稿
        </p>
      </div>

      {drafts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <PenLine className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">暂无草稿</p>
            <Button
              variant="link"
              size="sm"
              nativeButton={false}
              render={<Link href="/templates" />}
            >
              浏览可用模板
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {drafts.map((draft) => {
            const formData = draft.formData as Record<string, unknown>;
            const previewValues = getFormDataPreview(formData);

            return (
              <Card key={draft.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-sm">
                        {draft.template.name}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Preview of form values */}
                  <div className="space-y-1">
                    {previewValues.map((value, idx) => (
                      <p
                        key={idx}
                        className="text-sm text-muted-foreground truncate"
                      >
                        {value}
                      </p>
                    ))}
                    {previewValues.length === 0 && (
                      <p className="text-sm text-muted-foreground italic">
                        （空表单）
                      </p>
                    )}
                  </div>

                  {/* Updated time */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    {formatRelativeTime(draft.updatedAt)}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      render={
                        <Link
                          href={`/templates/${draft.templateId}/fill?draftId=${draft.id}`}
                        />
                      }
                    >
                      <PenLine className="h-4 w-4" />
                      继续编辑
                    </Button>
                    <DeleteDraftButton
                      draftId={draft.id}
                      draftName={draft.template.name}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
