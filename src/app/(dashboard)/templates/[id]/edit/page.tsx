import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { TemplateWizard } from "@/components/templates/template-wizard";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    notFound();
  }

  const { id } = await params;
  const template = await db.template.findUnique({ where: { id } });
  if (!template) notFound();

  return <TemplateWizard templateId={id} />;
}
