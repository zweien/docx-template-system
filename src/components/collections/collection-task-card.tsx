"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CollectionStatusBadge } from "@/components/collections/collection-status-badge";
import type { DocumentCollectionTaskListItem } from "@/types/document-collection";

function formatDateTime(value: Date) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CollectionTaskCard({ task }: { task: DocumentCollectionTaskListItem }) {
  return (
    <Link href={`/collections/${task.id}`}>
      <Card className="hover:border-zinc-400 transition-colors cursor-pointer">
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
          <Button variant="outline">
            查看详情
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}
