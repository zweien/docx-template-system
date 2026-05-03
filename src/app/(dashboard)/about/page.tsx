import { auth } from "@/lib/auth";
import { AppLogo } from "@/components/layout/app-logo";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExternalLink, Globe, Mail } from "lucide-react";

export default async function AboutPage() {
  await auth();
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8">
        <AppLogo className="h-16 w-auto" priority />
        <h1 className="text-2xl font-[510] tracking-tight text-foreground">
          IDRL 填表系统
        </h1>
        <p className="text-sm text-muted-foreground">v{version}</p>
        <p className="text-center text-sm text-muted-foreground">
          基于模板驱动的文档自动化生成平台。上传 Word 模板，配置占位符，填写表单即可一键生成文档。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">开发团队</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">IDRL Lab</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">idrl@example.com</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">相关链接</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <a
            href="https://github.com/zweien/docx-template-system"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 text-sm text-secondary-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
            GitHub 仓库
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
