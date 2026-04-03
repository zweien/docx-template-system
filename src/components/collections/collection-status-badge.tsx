import { Badge } from "@/components/ui/badge";
import type { DocumentCollectionSubmissionStatus } from "@/types/document-collection";

const STATUS_CONFIG: Record<
  DocumentCollectionSubmissionStatus,
  { label: string; variant: "secondary" | "default" | "destructive" }
> = {
  PENDING: { label: "待提交", variant: "secondary" },
  SUBMITTED: { label: "已提交", variant: "default" },
  LATE: { label: "已逾期", variant: "destructive" },
};

export function CollectionStatusBadge({
  status,
}: {
  status: DocumentCollectionSubmissionStatus;
}) {
  const config = STATUS_CONFIG[status];

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
