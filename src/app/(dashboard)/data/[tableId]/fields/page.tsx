import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTable, listTables } from "@/lib/services/data-table.service";
import { FieldConfigList } from "@/components/data/field-config-list";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// Always dynamically render to ensure fresh data after field updates
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ tableId: string }>;
}

export default async function FieldsPage({ params }: PageProps) {
  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="p-4 text-center">
        <p className="text-zinc-500">您没有权限访问此页面</p>
        <Link href="/data">
          <Button variant="outline" size="sm" className="mt-4">
            返回列表
          </Button>
        </Link>
      </div>
    );
  }

  const { tableId } = await params;

  const [tableResult, tablesResult] = await Promise.all([
    getTable(tableId),
    listTables(),
  ]);

  if (!tableResult.success) {
    if (tableResult.error.code === "NOT_FOUND") {
      notFound();
    }
    return (
      <div className="p-4 text-red-500">
        加载失败: {tableResult.error.message}
      </div>
    );
  }

  const table = tableResult.data;
  const availableTables = tablesResult.success
    ? tablesResult.data.filter((t) => t.id !== tableId)
    : [];

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
            <span>字段配置</span>
          </div>
          <h1 className="text-2xl font-semibold">
            配置字段 - {table.name}
          </h1>
          <p className="text-zinc-500 mt-1">
            定义数据表的字段结构，支持多种字段类型
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

      <Separator />

      {/* Field Config */}
      <FieldConfigList
        tableId={tableId}
        fields={table.fields}
        availableTables={availableTables}
        businessKeys={table.businessKeys}
      />
    </div>
  );
}
