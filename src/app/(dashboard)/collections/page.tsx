import { auth } from "@/lib/auth";
import { listDocumentCollectionTasks } from "@/lib/services/document-collection-task.service";
import { LinkButton } from "@/components/ui/button";
import { CollectionTaskCard } from "@/components/collections/collection-task-card";
import { PageHeader, EmptyState } from "@/components/shared";
import { Inbox } from "lucide-react";

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: "created" | "assigned" | "all"; status?: "active" | "closed" }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const userId = session?.user?.id;

  const result = userId
    ? await listDocumentCollectionTasks({
        userId,
        scope: params.scope,
        status: params.status,
      })
    : { success: true as const, data: [] };

  const tasks = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="文档收集"
        description="跟踪任务进度、查看我的提交状态并进入详情页。"
        actions={
          <LinkButton href="/collections/new">
            新建任务
          </LinkButton>
        }
      />

      {tasks.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="暂无文档收集任务"
        />
      ) : (
        <div className="grid gap-4">
          {tasks.map((task) => (
            <CollectionTaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
