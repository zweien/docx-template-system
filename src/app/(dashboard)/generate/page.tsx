import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, FileOutput } from "lucide-react";

export default async function GeneratePage() {

  const templates = await db.template.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      name: true,
      originalFileName: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">生成文档</h1>
        <p className="text-muted-foreground">
          选择一个模板，填写内容后即可生成文档
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <FileOutput className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">暂无可用模板</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            需要先上传并配置模板后才能生成文档
          </p>
          <Link
            href="/templates"
            className="mt-4 text-sm font-medium text-primary hover:underline"
          >
            前往模板管理
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {templates.map((t) => (
            <Link key={t.id} href={`/templates/${t.id}/fill`}>
              <Card className="h-full transition-colors hover:bg-accent cursor-pointer">
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <h3 className="font-semibold leading-tight truncate">
                        {t.name}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {t.originalFileName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end text-xs text-muted-foreground">
                    <span>{t.createdAt.toLocaleDateString("zh-CN")}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
