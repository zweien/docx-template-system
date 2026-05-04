import { AdminModelManager } from "@/components/agent2/admin-model-manager";
import { SuggestionManager } from "@/components/agent2/suggestion-manager";
import { BackupConfig } from "@/components/settings/backup-config";
import { ApiTokensTab } from "@/components/settings/api-tokens-tab";
import { PageHeader, ContentCard, Breadcrumbs } from "@/components/shared";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "管理后台", href: "/admin" }, { label: "系统设置" }]} />
      <PageHeader title="系统设置" />
      <div className="space-y-4">
        <ContentCard>
          <h2 className="text-lg font-[510] tracking-tight mb-1">AI 模型配置</h2>
          <p className="text-sm text-muted-foreground mb-6">
            在此处配置全局模型，这些模型将对所有用户可见。用户也可以添加自己的自定义模型。
          </p>
          <AdminModelManager />
        </ContentCard>

        <ContentCard>
          <h2 className="text-lg font-[510] tracking-tight mb-1">对话建议配置</h2>
          <p className="text-sm text-muted-foreground mb-6">
            管理新对话中显示给用户的建议提示文本。
          </p>
          <SuggestionManager />
        </ContentCard>

        <ContentCard>
          <h2 className="text-lg font-[510] tracking-tight mb-1">数据表备份</h2>
          <p className="text-sm text-muted-foreground mb-6">
            配置数据表自动备份，将所有数据表导出为 JSON 文件保存到服务器。
          </p>
          <BackupConfig />
        </ContentCard>

        <ContentCard>
          <ApiTokensTab />
        </ContentCard>
      </div>
    </div>
  );
}