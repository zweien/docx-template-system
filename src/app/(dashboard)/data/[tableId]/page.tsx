import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { ContentCard } from "@/components/shared";
import { getTable } from "@/lib/services/data-table.service";
import { TableDetailContent } from "@/components/data/table-detail-content";

interface PageProps {
  params: Promise<{ tableId: string }>;
}

export default async function TableDetailPage({ params }: PageProps) {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const { tableId } = await params;

  const result = await getTable(tableId);

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      notFound();
    }
    return (
      <ContentCard className="border-destructive/45">
        加载失败: {result.error.message}
      </ContentCard>
    );
  }

  const table = result.data;

  return <TableDetailContent tableId={tableId} table={table} isAdmin={isAdmin} />;
}
