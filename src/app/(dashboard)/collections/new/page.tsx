import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CollectionTaskForm } from "@/components/collections/collection-task-form";

export default async function NewCollectionPage() {
  const session = await auth();
  const users = await db.user.findMany({
    where: session?.user?.id ? { id: { not: session.user.id } } : undefined,
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">新建文档收集</h1>
        <p className="text-muted-foreground">创建任务、分配提交人并约定命名规则。</p>
      </div>

      <CollectionTaskForm
        assigneeOptions={users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
        }))}
      />
    </div>
  );
}
