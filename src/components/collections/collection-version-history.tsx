import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DocumentCollectionVersionItem } from "@/types/document-collection";

function formatDateTime(value: Date) {
  return value.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CollectionVersionHistory({
  taskId,
  versions,
}: {
  taskId: string;
  versions: DocumentCollectionVersionItem[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>版本历史</CardTitle>
      </CardHeader>
      <CardContent>
        {versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无提交记录</p>
        ) : (
          <div className="space-y-3">
            {versions.map((version) => (
              <div
                key={version.id}
                className="rounded-lg border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{`v${version.version}`}</span>
                  {version.isLate ? <Badge variant="destructive">逾期提交</Badge> : null}
                </div>
                <Link
                  href={`/api/collections/${taskId}/submissions/${version.id}/download`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm font-medium underline-offset-4 hover:underline"
                >
                  {version.fileName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(version.submittedAt)} · {formatFileSize(version.fileSize)} · {version.submittedByName}
                </p>
                {version.note ? <p className="mt-2 text-sm text-muted-foreground">{version.note}</p> : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
