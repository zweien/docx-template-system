import { auth } from "@/lib/auth";
import { AppLogo } from "@/components/layout/app-logo";
import { ContentCard } from "@/components/shared";
import { ExternalLink, Globe, Mail } from "lucide-react";

export default async function AboutPage() {
  await auth();
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
        <AppLogo className="h-16 w-auto" priority />
        <h1 className="text-2xl font-[510] tracking-tight text-foreground">
          IDRL 填表系统
        </h1>
        <p className="text-sm text-muted-foreground">v{version}</p>
        <p className="text-center text-sm text-muted-foreground">
          基于模板驱动的文档自动化生成平台。上传 Word 模板，配置占位符，填写表单即可一键生成文档。
        </p>
      </div>

      <ContentCard>
        <h2 className="text-base font-[510] tracking-tight mb-4">开发团队</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">IDRL Lab</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">idrl@example.com</span>
          </div>
        </div>
      </ContentCard>

      <ContentCard>
        <h2 className="text-base font-[510] tracking-tight mb-4">相关链接</h2>
        <div className="space-y-3">
          <a
            href="https://github.com/zweien/docx-template-system"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 text-sm text-secondary-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
            GitHub 仓库
          </a>
        </div>
      </ContentCard>
    </div>
  );
}
