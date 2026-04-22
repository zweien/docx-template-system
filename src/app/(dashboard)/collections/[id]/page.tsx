import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { auth } from "@/lib/auth";
import { getDocumentCollectionTaskDetail } from "@/lib/services/document-collection-task.service";
import { listDocumentCollectionSubmissionVersions } from "@/lib/services/document-collection-submission.service";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CollectionAssigneeTable } from "@/components/collections/collection-assignee-table";
import { CollectionCloseTaskButton } from "@/components/collections/collection-close-task-button";
import { CollectionRemindButton } from "@/components/collections/collection-remind-button";
import { CollectionStatusBadge } from "@/components/collections/collection-status-badge";
import { CollectionSubmissionUpload } from "@/components/collections/collection-submission-upload";
import { CollectionVersionHistory } from "@/components/collections/collection-version-history";

function formatDateTime(value: Date) {
  return value.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function CollectionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ assigneeId?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  const { id } = await params;
  const query = searchParams ? await searchParams : {};

  if (!userId) {
    notFound();
  }

  const detailResult = await getDocumentCollectionTaskDetail({
    taskId: id,
    userId,
  });

  if (!detailResult.success) {
    notFound();
  }

  const task = detailResult.data;
  const assignee = task.assignees[0] ?? null;
  const selectedAssigneeId =
    task.viewerRole === "creator"
      ? task.assignees.find((item) => item.id === query.assigneeId)?.id ?? task.assignees[0]?.id
      : assignee?.id;
  const versionsResult = selectedAssigneeId
      ? await listDocumentCollectionSubmissionVersions({
          taskId: task.id,
          userId,
          assigneeId: selectedAssigneeId,
        })
      : null;
  const versions = versionsResult?.success ? versionsResult.data : [];
  const selectedAssignee = task.assignees.find((item) => item.id === selectedAssigneeId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{task.title}</h1>
            <Badge variant="outline">
              {task.viewerRole === "creator" ? "创建者视角" : "提交人视角"}
            </Badge>
            {task.viewerRole === "assignee" && assignee ? (
              <CollectionStatusBadge status={assignee.status} />
            ) : null}
          </div>
          <p className="text-muted-foreground">{task.instruction}</p>
          <p className="text-sm text-muted-foreground">截止时间：{formatDateTime(task.dueAt)}</p>
        </div>

        {task.viewerRole === "creator" ? (
          <div className="flex flex-wrap gap-2">
            {task.status === "ACTIVE" ? <CollectionCloseTaskButton taskId={task.id} /> : null}
            {task.status === "ACTIVE" ? <CollectionRemindButton taskId={task.id} /> : null}
            <LinkButton href={`/api/collections/${task.id}/download`}>
              <Download className="h-4 w-4" />
              下载汇总压缩包
            </LinkButton>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>命名规则</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{task.renameRule}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>提交人数</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{task.assignees.length} 人</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>参考附件</CardTitle>
            <CardDescription>当前任务附带的参考文件</CardDescription>
          </CardHeader>
          <CardContent>
            {task.attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无附件</p>
            ) : (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {task.attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <Link
                      href={`/api/collections/${task.id}/attachments/${attachment.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline-offset-4 hover:underline"
                    >
                      {attachment.originalFileName}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {task.viewerRole === "creator" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
          <Card>
            <CardHeader>
              <CardTitle>提交人进度</CardTitle>
              <CardDescription>查看每位提交人的状态、最新文件，并切换右侧历史版本。</CardDescription>
            </CardHeader>
            <CardContent>
              <CollectionAssigneeTable
                taskId={task.id}
                selectedAssigneeId={selectedAssigneeId}
                assignees={task.assignees}
              />
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              当前查看：
              <span className="ml-1 text-foreground">
                {selectedAssignee
                  ? `${selectedAssignee.userName}（${selectedAssignee.userEmail}）`
                  : "暂无提交人"}
              </span>
            </div>
            <CollectionVersionHistory taskId={task.id} versions={versions} />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <CollectionSubmissionUpload taskId={task.id} />
          <CollectionVersionHistory taskId={task.id} versions={versions} />
        </div>
      )}
    </div>
  );
}
