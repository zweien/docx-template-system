import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AutomationEditor } from "@/components/automations/automation-editor";
import { AutomationDetailLive } from "@/components/automations/automation-detail-live";
import { Breadcrumbs, PageHeader, ContentCard } from "@/components/shared";
import { getAutomation } from "@/lib/services/automation.service";
import type { AutomationRunItem } from "@/types/automation";

export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const { id } = await params;
  const result = await getAutomation(id, session.user.id);
  if (!result.success) {
    notFound();
  }

  const runs = await db.automationRun.findMany({
    where: { automationId: id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const runItems: AutomationRunItem[] = runs.map((run) => ({
    id: run.id,
    automationId: run.automationId,
    status: run.status as AutomationRunItem["status"],
    triggerSource: run.triggerSource as AutomationRunItem["triggerSource"],
    triggerPayload: (run.triggerPayload ?? {}) as Record<string, unknown>,
    contextSnapshot: (run.contextSnapshot ?? {}) as Record<string, unknown>,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    durationMs: run.durationMs,
    errorCode: run.errorCode,
    errorMessage: run.errorMessage,
    createdAt: run.createdAt,
  }));

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: "自动化", href: "/automations" },
        { label: result.data.name },
      ]} />

      <PageHeader
        title={result.data.name}
        description="编辑触发器、条件分支和动作执行顺序。当前为第一期受限画布模式。"
      />

      <ContentCard>
        <AutomationDetailLive
          automationId={result.data.id}
          initialRuns={runItems}
        />
      </ContentCard>

      <AutomationEditor
        mode="edit"
        automationId={result.data.id}
        initialName={result.data.name}
        initialDescription={result.data.description}
        initialEnabled={result.data.enabled}
        initialTableId={result.data.tableId}
        initialValue={result.data.definition}
      />
    </div>
  );
}
