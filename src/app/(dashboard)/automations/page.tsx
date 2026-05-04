import { auth } from "@/lib/auth";
import { listAutomations } from "@/lib/services/automation.service";
import { AutomationList } from "@/components/automations/automation-list";
import { LinkButton } from "@/components/ui/button";
import { PageHeader, ContentCard } from "@/components/shared";
import { Zap, ToggleLeft, ToggleRight } from "lucide-react";

export default async function AutomationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const result = await listAutomations(session.user.id);
  const items = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="自动化"
        description="管理表级触发器、条件分支和动作执行。当前版本支持记录创建/更新/删除、字段变更、定时触发与手动触发。"
        actions={
          <LinkButton href="/automations/new">
            新建自动化
          </LinkButton>
        }
      />

      <ContentCard>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-xs font-[510] uppercase tracking-wider text-[#62666d]">
              总规则
            </p>
            <p className="mt-3 text-3xl font-[510] tracking-tight text-foreground">
              {items.length}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-xs font-[510] uppercase tracking-wider text-[#62666d]">
              启用中
            </p>
            <p className="mt-3 text-3xl font-[510] tracking-tight text-foreground">
              {items.filter((item) => item.enabled).length}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-xs font-[510] uppercase tracking-wider text-[#62666d]">
              停用中
            </p>
            <p className="mt-3 text-3xl font-[510] tracking-tight text-foreground">
              {items.filter((item) => !item.enabled).length}
            </p>
          </div>
        </div>
      </ContentCard>

      <AutomationList items={items} />
    </div>
  );
}
