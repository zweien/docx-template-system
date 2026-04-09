import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTable } from "@/lib/services/data-table.service";
import { getRecord, updateRecord } from "@/lib/services/data-record.service";
import { DynamicRecordForm } from "@/components/data/dynamic-record-form";

interface PageProps {
  params: Promise<{ tableId: string; recordId: string }>;
}

export default async function EditRecordPage({ params }: PageProps) {
  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    redirect("/data");
  }

  const { tableId, recordId } = await params;

  const [tableResult, recordResult] = await Promise.all([
    getTable(tableId),
    getRecord(recordId),
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

  if (!recordResult.success) {
    if (recordResult.error.code === "NOT_FOUND") {
      notFound();
    }
    return (
      <div className="p-4 text-red-500">
        加载记录失败: {recordResult.error.message}
      </div>
    );
  }

  const table = tableResult.data;
  const record = recordResult.data;

  async function handleUpdate(data: Record<string, unknown>) {
    "use server";

    const result = await updateRecord(recordId, data, session!.user!.id);

    if (!result.success) {
      throw new Error(result.error.message);
    }

    redirect(`/data/${tableId}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1">
          <Link href="/data" className="hover:underline">主数据</Link>
          <span>/</span>
          <Link href={`/data/${tableId}`} className="hover:underline">{table.name}</Link>
          <span>/</span>
          <span>编辑记录</span>
        </div>
        <h1 className="text-2xl font-semibold">编辑记录</h1>
        <p className="text-zinc-500 mt-1">
          修改{table.name}记录信息
        </p>
      </div>

      {/* Form */}
      <div className="bg-card rounded-lg border p-6">
        <DynamicRecordForm
          tableId={tableId}
          fields={table.fields}
          initialData={record}
          onSubmit={handleUpdate}
          submitLabel="保存修改"
        />
      </div>
    </div>
  );
}
