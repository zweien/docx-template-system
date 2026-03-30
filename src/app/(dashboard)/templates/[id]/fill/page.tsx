import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { DynamicForm } from "@/components/forms/dynamic-form";

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
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        render={<Link href={`/templates/${id}`} />}
      >
        <ArrowLeft className="h-4 w-4" />
        返回模板详情
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          填写表单 — {template.name}
        </h1>
        <p className="text-muted-foreground">
          请填写以下字段，完成后点击「确认生成」来生成文档
        </p>
      </div>

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
    </div>
  );
}
