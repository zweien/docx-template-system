import { auth } from "@/lib/auth";
import { listTables } from "@/lib/services/data-table.service";
import { deleteTable } from "@/lib/services/data-table.service";
import { TableCard } from "@/components/data/table-card";
import { CreateTableDialog } from "@/components/data/create-table-dialog";
import { Button } from "@/components/ui/button";

export default async function DataPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const result = await listTables();
  const tables = result.success ? result.data : [];

  async function handleDeleteTable(id: string) {
    "use server";
    await deleteTable(id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">主数据</h1>
          <p className="text-zinc-500 mt-1">
            管理自定义数据表，支持多种字段类型和 Excel 导入
          </p>
        </div>
        {isAdmin && <CreateTableDialog />}
      </div>

      {tables.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 mb-4">
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
              className="text-zinc-400"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <line x1="3" x2="21" y1="9" y2="9" />
              <line x1="9" x2="9" y1="21" y2="9" />
            </svg>
          </div>
          <h3 className="text-lg font-medium mb-2">暂无数据表</h3>
          <p className="text-zinc-500 mb-4">
            {isAdmin
              ? "创建第一个数据表来开始管理您的业务数据"
              : "管理员尚未创建任何数据表"}
          </p>
          {isAdmin && <CreateTableDialog trigger={<Button>新建数据表</Button>} />}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
