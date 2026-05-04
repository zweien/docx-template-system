import { auth } from "@/lib/auth";
import { AppLogo } from "@/components/layout/app-logo";
import { ContentCard } from "@/components/shared";
import { ExternalLink } from "lucide-react";

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
          模板驱动的办公自动化系统。上传 Word 模板，配置占位符，填写表单即可一键生成文档。
        </p>
      </div>

      <ContentCard>
        <h2 className="text-base font-[510] tracking-tight mb-4">功能概览</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li><span className="text-foreground font-[510]">模板与文档</span> — 模板管理、智能解析、动态表单、批量生成、草稿系统</li>
          <li><span className="text-foreground font-[510]">报告撰写</span> — 富文本编辑器、AI 智能写作、实时协作、附件管理</li>
          <li><span className="text-foreground font-[510]">主数据管理</span> — 自定义数据表、15 种字段类型、5 种视图、公式引擎</li>
          <li><span className="text-foreground font-[510]">文档收集</span> — 任务管理、文件提交、版本追踪、批量下载</li>
          <li><span className="text-foreground font-[510]">自动化引擎</span> — 多种触发器、条件分支、动作执行、运行日志</li>
          <li><span className="text-foreground font-[510]">AI 智能助手</span> — 多模型对话、AI 填充助手、MCP 工具调用</li>
          <li><span className="text-foreground font-[510]">预算报告</span> — Excel 数据校验、三步向导、配置管理</li>
          <li><span className="text-foreground font-[510]">桌面应用</span> — Tauri 2.0，内置 Python sidecar，支持离线运行</li>
        </ul>
      </ContentCard>

      <ContentCard>
        <h2 className="text-base font-[510] tracking-tight mb-4">技术栈</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
          <span>Next.js 16 / React 19 / TypeScript</span>
          <span>Prisma 7 + PostgreSQL</span>
          <span>shadcn/ui v4 + Tailwind CSS 4</span>
          <span>NextAuth v4 + Authentik OIDC</span>
          <span>BlockNote + Yjs 实时协作</span>
          <span>Tauri 2.0 桌面应用</span>
          <span>Python FastAPI 文档服务</span>
          <span>Vitest + Testing Library</span>
        </div>
      </ContentCard>

      <ContentCard>
        <h2 className="text-base font-[510] tracking-tight mb-4">开发团队</h2>
        <p className="text-sm text-muted-foreground">IDRL</p>
      </ContentCard>

      <ContentCard>
        <h2 className="text-base font-[510] tracking-tight mb-4">相关链接</h2>
        <a
          href="https://github.com/zweien/docx-template-system"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 text-sm text-secondary-foreground transition-colors hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
          GitHub 仓库
        </a>
      </ContentCard>
    </div>
  );
}
