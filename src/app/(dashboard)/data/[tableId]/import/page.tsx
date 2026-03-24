import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTable } from "@/lib/services/data-table.service";
import { ImportWizard } from "@/components/data/import-wizard";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ tableId: string }>;
}

export default async function ImportPage({ params }: PageProps) {
  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    redirect("/data");
  }

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1">
            <Link href="/data" className="hover:underline">主数据</Link>
            <span>/</span>
            <Link href={`/data/${tableId}`} className="hover:underline">{table.name}</Link>
            <span>/</span>
            <span>导入数据</span>
          </div>
          <h1 className="text-2xl font-semibold">导入数据</h1>
          <p className="text-zinc-500 mt-1">
            从 Excel 文件批量导入数据到 {table.name}
          </p>
        </div>
        <Link href={`/data/${tableId}`}>
          <Button variant="outline" size="sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1"
            >
              <line x1="19" x2="5" y1="12" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            返回
          </Button>
        </Link>
      </div>

      {/* Import Wizard */}
      <ImportWizard tableId={tableId} fields={table.fields} />
    </div>
  );
}
