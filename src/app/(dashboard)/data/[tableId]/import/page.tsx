import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTable } from "@/lib/services/data-table.service";
import { ImportWizard } from "@/components/data/import-wizard";
import { PageHeader, Breadcrumbs } from "@/components/shared";

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
      <Breadcrumbs items={[
        { label: "主数据", href: "/data" },
        { label: table.name, href: `/data/${tableId}` },
        { label: "导入数据" },
      ]} />

      <PageHeader
        title="导入数据"
        description={`从 Excel 文件批量导入数据到 ${table.name}`}
      />

      <ImportWizard tableId={tableId} fields={table.fields} table={table} />
    </div>
  );
}
