import { PlaceholderConfigTable } from "@/components/templates/placeholder-config-table";

export default async function ConfigurePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">配置占位符</h1>
        <p className="text-muted-foreground">
          编辑模板中的占位符字段，配置标签、类型和排序
        </p>
      </div>
      <PlaceholderConfigTable templateId={id} />
    </div>
  );
}
