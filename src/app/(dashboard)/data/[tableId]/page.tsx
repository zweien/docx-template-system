import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
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
      <div className="p-4 text-red-500">
        加载失败: {result.error.message}
      </div>
    );
  }

  const table = result.data;

  return <TableDetailContent tableId={tableId} table={table} isAdmin={isAdmin} />;
}