import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/shared";
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
      <PageHeader
        title="我的草稿"
        description={`共 ${drafts.length} 个草稿`}
      />

      {drafts.length === 0 ? (
        <EmptyState
          icon={PenLine}
          title="暂无草稿"
          action={
            <LinkButton
              variant="link"
              size="sm"
              href="/templates"
            >
              浏览可用模板
            </LinkButton>
          }
        />
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
