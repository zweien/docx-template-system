import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { PenLine } from "lucide-react";
import { DraftCard } from "@/components/drafts/draft-card";

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
            <LinkButton
              variant="link"
              size="sm"
              href="/templates"
            >
              浏览可用模板
            </LinkButton>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              id={draft.id}
              templateId={draft.templateId}
              templateName={draft.template.name}
              formData={draft.formData as Record<string, unknown>}
              updatedAt={draft.updatedAt}
            />
          ))}
        </div>
      )}
    </div>
  );
}
