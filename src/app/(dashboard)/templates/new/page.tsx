import { UploadForm } from "@/components/templates/upload-form";

export default async function NewTemplatePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">上传模板</h1>
        <p className="text-muted-foreground">上传 .docx 模板文件并进行配置</p>
      </div>
      <UploadForm />
    </div>
  );
}
