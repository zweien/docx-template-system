import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AutomationEditor } from "@/components/automations/automation-editor";
import { AutomationDetailLive } from "@/components/automations/automation-detail-live";
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
      <div className="rounded-2xl border border-border/80 bg-card/90 p-6">
        <p className="text-xs font-[520] uppercase tracking-[0.18em] text-muted-foreground">
          自动化详情
        </p>
        <h1 className="mt-2 text-3xl font-[520] tracking-[-0.04em] text-foreground">
          {result.data.name}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          编辑触发器、条件分支和动作执行顺序。当前为第一期受限画布模式。
        </p>
        <div className="mt-4">
          <AutomationDetailLive
            automationId={result.data.id}
            initialRuns={runItems}
          />
        </div>
      </div>

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
