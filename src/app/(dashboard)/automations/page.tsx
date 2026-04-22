import { auth } from "@/lib/auth";
import { listAutomations } from "@/lib/services/automation.service";
import { AutomationList } from "@/components/automations/automation-list";

export default async function AutomationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const result = await listAutomations(session.user.id);
  const items = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/90">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <div className="space-y-3">
            <div className="inline-flex items-center rounded-full border border-border/80 bg-background/80 px-3 py-1 text-xs font-[520] text-muted-foreground">
              表级自动化工作台
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-[520] tracking-[-0.04em] text-foreground">
                自动化
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                管理表级触发器、条件分支和动作执行。当前版本支持记录创建/更新/删除、
                字段变更、定时触发与手动触发。
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="text-xs font-[520] uppercase tracking-[0.18em] text-muted-foreground">
                总规则
              </p>
              <p className="mt-3 text-3xl font-[520] tracking-[-0.05em] text-foreground">
                {items.length}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="text-xs font-[520] uppercase tracking-[0.18em] text-muted-foreground">
                启用中
              </p>
              <p className="mt-3 text-3xl font-[520] tracking-[-0.05em] text-foreground">
                {items.filter((item) => item.enabled).length}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="text-xs font-[520] uppercase tracking-[0.18em] text-muted-foreground">
                停用中
              </p>
              <p className="mt-3 text-3xl font-[520] tracking-[-0.05em] text-foreground">
                {items.filter((item) => !item.enabled).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <AutomationList items={items} />
    </div>
  );
}
