import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DocumentCollectionAssigneeItem } from "@/types/document-collection";
import { CollectionStatusBadge } from "./collection-status-badge";

function formatDateTime(value: Date | null) {
  if (!value) {
    return "-";
  }

  return value.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CollectionAssigneeTable({
  taskId,
  selectedAssigneeId,
  assignees,
}: {
  taskId: string;
  selectedAssigneeId?: string;
  assignees: DocumentCollectionAssigneeItem[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>提交人</TableHead>
          <TableHead>邮箱</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>版本数</TableHead>
          <TableHead>最近提交</TableHead>
          <TableHead>最新文件</TableHead>
          <TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assignees.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
              暂无提交人
            </TableCell>
          </TableRow>
        ) : (
          assignees.map((assignee) => (
            <TableRow
              key={assignee.id}
              data-state={selectedAssigneeId === assignee.id ? "selected" : undefined}
            >
              <TableCell>{assignee.userName}</TableCell>
              <TableCell>{assignee.userEmail}</TableCell>
              <TableCell>
                <CollectionStatusBadge status={assignee.status} />
              </TableCell>
              <TableCell>{assignee.versionCount}</TableCell>
              <TableCell>{formatDateTime(assignee.submittedAt)}</TableCell>
              <TableCell>
                {assignee.latestVersion ? (
                  <Link
                    href={`/api/collections/${taskId}/submissions/${assignee.latestVersion.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-4 hover:underline"
                  >
                    {assignee.latestVersion.originalFileName}
                  </Link>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>
                <Link
                  href={`/collections/${taskId}?assigneeId=${assignee.id}`}
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  查看历史
                </Link>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
