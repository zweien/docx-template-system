import Link from "next/link";
import { auth } from "@/lib/auth";
import { listDocumentCollectionTasks } from "@/lib/services/document-collection-task.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CollectionStatusBadge } from "@/components/collections/collection-status-badge";

function formatDateTime(value: Date) {
  return value.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
        <Button nativeButton={false} render={<Link href="/collections/new" />}>
          新建任务
        </Button>
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
            <Card key={task.id}>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle>{task.title}</CardTitle>
                  <CardDescription>截止时间：{formatDateTime(task.dueAt)}</CardDescription>
                </div>
                {task.myStatus ? <CollectionStatusBadge status={task.myStatus} /> : null}
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>{task.assigneeCount} 位提交人</span>
                  <span>已提交 {task.submittedCount}</span>
                  <span>待提交 {task.pendingCount}</span>
                  <span>逾期 {task.lateCount}</span>
                </div>
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={<Link href={`/collections/${task.id}`} />}
                >
                  查看详情
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
