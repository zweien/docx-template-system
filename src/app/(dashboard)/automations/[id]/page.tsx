import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AutomationEditor } from "@/components/automations/automation-editor";
import { AutomationRunLog } from "@/components/automations/automation-run-log";
import { getAutomation } from "@/lib/services/automation.service";

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
      </div>

      <AutomationEditor
        automationId={result.data.id}
        initialName={result.data.name}
        initialDescription={result.data.description}
        initialEnabled={result.data.enabled}
        initialValue={result.data.definition}
      />

      <AutomationRunLog items={runs} />
    </div>
  );
}
