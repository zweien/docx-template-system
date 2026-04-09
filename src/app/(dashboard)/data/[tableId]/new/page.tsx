import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTable } from "@/lib/services/data-table.service";
import { createRecord } from "@/lib/services/data-record.service";
import { DynamicRecordForm } from "@/components/data/dynamic-record-form";

interface PageProps {
  params: Promise<{ tableId: string }>;
}

export default async function NewRecordPage({ params }: PageProps) {
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

  async function handleCreate(data: Record<string, unknown>) {
    "use server";

    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("未授权");
    }

    const result = await createRecord(session.user.id, tableId, data);

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
          <span>新建记录</span>
        </div>
        <h1 className="text-2xl font-semibold">新建记录</h1>
        <p className="text-zinc-500 mt-1">
          填写以下信息创建新的{table.name}记录
        </p>
      </div>

      {/* Form */}
      <div className="bg-card rounded-lg border p-6">
        <DynamicRecordForm
          tableId={tableId}
          fields={table.fields}
          onSubmit={handleCreate}
          submitLabel="创建"
        />
      </div>
    </div>
  );
}
