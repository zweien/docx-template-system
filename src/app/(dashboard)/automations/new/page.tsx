import { auth } from "@/lib/auth";
import { createDefaultAutomationDefinition } from "@/lib/automation-defaults";
import { AutomationEditor } from "@/components/automations/automation-editor";
import { listTables } from "@/lib/nocodb";
import { PageHeader, Breadcrumbs } from "@/components/shared";

export default async function NewAutomationPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  let tables: Array<{ id: string; name: string }> = [];
  try {
    const result = await listTables();
    tables = result
      .map((t) => ({ id: t.id, name: t.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  } catch (error) {
    console.error("获取数据表列表失败:", error);
  }

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
