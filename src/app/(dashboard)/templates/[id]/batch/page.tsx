import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { BatchGenerationWizard } from "./wizard";
import { PageHeader, Breadcrumbs } from "@/components/shared";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BatchGenerationPage({ params }: PageProps) {
  const { id } = await params;

  const template = await db.template.findUnique({
    where: { id },
    select: { id: true, name: true, status: true, dataTableId: true },
  });

  if (!template || template.status !== "PUBLISHED") {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: "模板库", href: "/templates" },
        { label: template.name, href: `/templates/${id}` },
        { label: "批量生成" },
      ]} />

      <PageHeader
        title={`批量生成 — ${template.name}`}
        description="从主数据表选择记录，批量生成文档"
      />

      <BatchGenerationWizard templateId={id} linkedDataTableId={template.dataTableId} />
    </div>
  );
}
