import { auth } from "@/lib/auth";
import { listTables } from "@/lib/services/data-table.service";
import { deleteTable } from "@/lib/services/data-table.service";
import { TableCard } from "@/components/data/table-card";
import { CreateTableDialog } from "@/components/data/create-table-dialog";
import { ImportTableDialog } from "@/components/data/import-table-dialog";
import { Button } from "@/components/ui/button";

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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/70 p-5">
        <div>
          <h1 className="text-3xl font-[510] tracking-[-0.7px] text-foreground">主数据</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理自定义数据表，支持多种字段类型和 Excel 导入
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <ImportTableDialog />
            <CreateTableDialog />
          </div>
        )}
      </div>

      {tables.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/70 py-12 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted/60">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <line x1="3" x2="21" y1="9" y2="9" />
              <line x1="9" x2="9" y1="21" y2="9" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-[510] text-foreground">暂无数据表</h3>
          <p className="mb-4 text-muted-foreground">
            {isAdmin
              ? "创建第一个数据表来开始管理您的业务数据"
              : "管理员尚未创建任何数据表"}
          </p>
          {isAdmin && <CreateTableDialog trigger={<Button>新建数据表</Button>} />}
        </div>
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
