import { DownloadTemplateForm } from "@/components/templates/download-template-form";
import { Breadcrumbs } from "@/components/shared";

export default function NewDownloadTemplatePage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: "模板库", href: "/templates" },
        { label: "上传文件下载型模板" },
      ]} />
      <DownloadTemplateForm />
    </div>
  );
}
