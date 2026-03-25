import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { BatchGenerationWizard } from "./wizard";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BatchGenerationPage({ params }: PageProps) {
  const { id } = await params;

  const template = await db.template.findUnique({
    where: { id },
    select: { id: true, name: true, status: true, dataTableId: true },
  });

  if (!template || template.status !== "READY") {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" render={<Link href={`/templates/${id}`} />}>
        <ArrowLeft className="h-4 w-4" />
        返回模板详情
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          批量生成 — {template.name}
        </h1>
        <p className="text-muted-foreground">
          从主数据表选择记录，批量生成文档
        </p>
      </div>

      <BatchGenerationWizard templateId={id} linkedDataTableId={template.dataTableId} />
    </div>
  );
}
