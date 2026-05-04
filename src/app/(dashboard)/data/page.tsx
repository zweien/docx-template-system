import { auth } from "@/lib/auth";
import { listTables } from "@/lib/services/data-table.service";
import { deleteTable } from "@/lib/services/data-table.service";
import { TableCard } from "@/components/data/table-card";
import { CreateTableDialog } from "@/components/data/create-table-dialog";
import { ImportTableDialog } from "@/components/data/import-table-dialog";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/shared";
import { Table as TableIcon } from "lucide-react";

export default async function DataPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const result = await listTables();
  const tables = result.success ? result.data : [];

  async function handleDeleteTable(id: string) {
    "use server";
    const result = await deleteTable(id);
    if (!result.success) {
      throw new Error(result.error.message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="主数据"
        description="管理自定义数据表，支持多种字段类型和 Excel 导入"
        actions={
          isAdmin ? (
            <div className="flex items-center gap-2">
              <ImportTableDialog />
              <CreateTableDialog />
            </div>
          ) : undefined
        }
      />

      {tables.length === 0 ? (
        <EmptyState
          icon={TableIcon}
          title="暂无数据表"
          description={
            isAdmin
              ? "创建第一个数据表来开始管理您的业务数据"
              : "管理员尚未创建任何数据表"
          }
          action={
            isAdmin ? (
              <CreateTableDialog trigger={<Button>新建数据表</Button>} />
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              onDelete={handleDeleteTable}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
