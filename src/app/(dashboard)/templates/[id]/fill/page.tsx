import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { DynamicForm } from "@/components/forms/dynamic-form";
import { ScreenshotViewer } from "@/components/templates/screenshot-viewer";
import { PageHeader, ContentCard, Breadcrumbs } from "@/components/shared";

export default async function FillPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ draftId?: string }>;
}) {
  const { id } = await params;
  const { draftId } = await searchParams;

  const template = await db.template.findUnique({
    where: { id },
    include: {
      placeholders: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!template || template.status !== "PUBLISHED") {
    notFound();
  }

  let initialData: Record<string, unknown> | undefined;
  if (draftId) {
    const draft = await db.draft.findUnique({ where: { id: draftId } });
    if (draft) {
      initialData = draft.formData as Record<string, unknown>;
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: "模板库", href: "/templates" },
        { label: template.name, href: `/templates/${id}` },
        { label: "填写表单" },
      ]} />

      <PageHeader
        title={`填写表单 — ${template.name}`}
        description="请填写以下字段，完成后点击「确认生成」来生成文档"
      />

      {template.screenshot && (
        <div className="max-w-xs">
          <ScreenshotViewer src={template.screenshot} alt={template.name} />
        </div>
      )}

      <ContentCard>
        <DynamicForm
          templateId={id}
          placeholders={template.placeholders.map((p) => ({
            id: p.id,
            key: p.key,
            label: p.label,
            inputType: p.inputType as "TEXT" | "TEXTAREA" | "TABLE" | "CHOICE_SINGLE" | "CHOICE_MULTI",
            required: p.required,
            defaultValue: p.defaultValue,
            sortOrder: p.sortOrder,
            sourceTableId: p.sourceTableId,
            sourceField: p.sourceField,
            enablePicker: p.enablePicker,
            columns: p.columns as Array<{ key: string; label: string }> | undefined,
            choiceConfig: p.choiceConfig as {
              mode: "single" | "multiple";
              options: Array<{ value: string; label: string }>;
              marker: { template: string; checked: string; unchecked: string };
            } | null | undefined,
            description: p.description,
          }))}
          initialData={initialData as Record<string, string | string[] | Record<string, string>[]> | undefined}
          draftId={draftId}
        />
      </ContentCard>
    </div>
  );
}
