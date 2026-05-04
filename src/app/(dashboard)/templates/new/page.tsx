import { TemplateWizard } from "@/components/templates/template-wizard";
import { Breadcrumbs } from "@/components/shared";

export default function NewTemplatePage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: "模板库", href: "/templates" },
        { label: "上传模板" },
      ]} />
      <TemplateWizard />
    </div>
  );
}
