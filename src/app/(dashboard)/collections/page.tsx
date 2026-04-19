import { auth } from "@/lib/auth";
import { listDocumentCollectionTasks } from "@/lib/services/document-collection-task.service";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CollectionTaskCard } from "@/components/collections/collection-task-card";

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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">文档收集</h1>
          <p className="text-muted-foreground">跟踪任务进度、查看我的提交状态并进入详情页。</p>
        </div>
        <LinkButton href="/collections/new">
          新建任务
        </LinkButton>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            暂无文档收集任务
          </CardContent>
        </Card>
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
