import { AdminModelManager } from "@/components/agent2/admin-model-manager";
import { SuggestionManager } from "@/components/agent2/suggestion-manager";
import { BackupConfig } from "@/components/settings/backup-config";
import { ApiTokensTab } from "@/components/settings/api-tokens-tab";

export default function AdminSettingsPage() {
  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">系统设置</h1>
      <div className="space-y-6">
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">AI 模型配置</h2>
          <p className="text-sm text-muted-foreground mb-6">
            在此处配置全局模型，这些模型将对所有用户可见。用户也可以添加自己的自定义模型。
          </p>
          <AdminModelManager />
        </div>

        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">对话建议配置</h2>
          <p className="text-sm text-muted-foreground mb-6">
            管理新对话中显示给用户的建议提示文本。
          </p>
          <SuggestionManager />
        </div>

        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">数据表备份</h2>
          <p className="text-sm text-muted-foreground mb-6">
            配置数据表自动备份，将所有数据表导出为 JSON 文件保存到服务器。
          </p>
          <BackupConfig />
        </div>

        <div className="bg-card rounded-lg border p-6">
          <ApiTokensTab />
        </div>
      </div>
    </div>
  );
}