import { auth } from "@/lib/auth";
import { createDefaultAutomationDefinition } from "@/lib/automation-defaults";
import { AutomationEditor } from "@/components/automations/automation-editor";
import { listTables } from "@/lib/services/data-table.service";
import { PageHeader, Breadcrumbs } from "@/components/shared";

export default async function NewAutomationPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const tablesResult = await listTables();
  const tables = tablesResult.success
    ? [...tablesResult.data].sort((left, right) => left.name.localeCompare(right.name, "zh-CN"))
    : [];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: "自动化", href: "/automations" },
        { label: "创建规则" },
      ]} />

      <PageHeader
        title="创建规则"
        description="先选择目标数据表，再配置触发器、条件和动作。创建后会跳转到详情页继续编辑。"
      />

      <AutomationEditor
        mode="create"
        initialTableId={tables[0]?.id ?? ""}
        availableTables={tables}
        initialName="未命名自动化"
        initialDescription={null}
        initialEnabled={true}
        initialValue={createDefaultAutomationDefinition()}
      />
    </div>
  );
}
