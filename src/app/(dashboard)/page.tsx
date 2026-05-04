import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@/generated/prisma/enums";
import { PageHeader, ContentCard } from "@/components/shared";
import { cn } from "@/lib/utils";
import {
  FileText,
  PenLine,
  Database,
  Clock,
  AlertCircle,
  Users,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import type { ComponentType } from "react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString();
}

/* ------------------------------------------------------------------ */
/*  Inline: QuickActionCard                                           */
/* ------------------------------------------------------------------ */

function QuickActionCard({
  href,
  icon: Icon,
  label,
  description,
  accent,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  description: string;
  accent?: "primary" | "success";
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-hover hover:bg-surface-hover"
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md",
          accent === "primary" && "bg-primary/15 text-accent",
          accent === "success" && "bg-emerald-500/15 text-emerald-400",
          !accent && "bg-white/[0.08] text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-[13px] font-[510] text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default async function WorkspacePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const isAdmin = session.user.role === Role.ADMIN;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  /* ---- parallel data fetches ---- */
  const [
    publishedTemplates,
    monthlyRecords,
    drafts,
    pendingTasks,
    recentRecords,
    teamActivity,
    recentReports,
  ] = await Promise.all([
    db.template.count({ where: { status: "PUBLISHED" } }),
    db.record.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.draft.count({ where: { userId } }),
    db.documentCollectionAssignee.findMany({
      where: { userId, submittedAt: null },
      include: {
        task: { select: { id: true, title: true, dueAt: true } },
      },
      orderBy: { task: { dueAt: "asc" } },
      take: 5,
    }),
    db.record.findMany({
      where: { userId },
      select: {
        id: true,
        createdAt: true,
        template: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.record.findMany({
      select: {
        id: true,
        createdAt: true,
        template: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.reportDraft.findMany({
      where: { userId },
      select: { id: true, title: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 3,
    }),
  ]);

  /* ---- derive greeting & pending count ---- */
  const pendingCount = pendingTasks.length;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "上午好" : hour < 18 ? "下午好" : "晚上好";
  const headerDescription = `${greeting}，${session.user.name}${pendingCount > 0 ? ` — 你有 ${pendingCount} 项待办` : ""}`;

  /* ---- deduplicate recent templates (by templateId) ---- */
  const seenIds = new Set<string>();
  const uniqueRecent: { id: string; createdAt: Date; template: { id: string; name: string } }[] = [];
  for (const r of recentRecords) {
    if (!seenIds.has(r.template.id)) {
      seenIds.add(r.template.id);
      uniqueRecent.push(r);
    }
  }

  /* ---- combine recent templates + recent reports ---- */
  type RecentItem =
    | { kind: "template"; name: string; href: string; time: Date }
    | { kind: "report"; name: string; href: string; time: Date };
  const recentItems: RecentItem[] = [
    ...uniqueRecent.map((r) => ({
      kind: "template" as const,
      name: r.template.name,
      href: `/generate?templateId=${r.template.id}`,
      time: r.createdAt,
    })),
    ...recentReports.map((r) => ({
      kind: "report" as const,
      name: r.title,
      href: `/reports/${r.id}/edit`,
      time: r.updatedAt,
    })),
  ].sort((a, b) => b.time.getTime() - a.time.getTime());

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <PageHeader title="工作台" description={headerDescription} />

      {/* ---- Row 1: Quick Actions ---- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QuickActionCard
          href="/generate"
          icon={FileText}
          label="我要填表"
          description="选择模板填写并生成文档"
          accent="primary"
        />
        <QuickActionCard
          href="/reports/new"
          icon={PenLine}
          label="撰写报告"
          description="使用模板撰写工作报告"
          accent="success"
        />
        <QuickActionCard
          href="/data"
          icon={Database}
          label="数据表"
          description="管理结构化数据表格"
        />
      </div>

      {/* ---- Row 2: Pending Tasks + Recent ---- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 我的待办 */}
        <ContentCard>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-[510] text-foreground">
                我的待办
              </span>
              {pendingCount > 0 && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-[510] text-primary">
                  {pendingCount}
                </span>
              )}
            </div>
            <Link
              href="/collections"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              查看全部
            </Link>
          </div>
          {pendingTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckIcon className="mb-2 h-8 w-8 opacity-40" />
              <p className="text-sm">暂无待办事项</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pendingTasks.map((item) => {
                const isOverdue =
                  item.task.dueAt && item.task.dueAt < new Date();
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-[510] text-foreground">
                        {item.task.title}
                      </div>
                      {item.task.dueAt && (
                        <div
                          className={cn(
                            "mt-0.5 text-xs",
                            isOverdue ? "text-red-400" : "text-text-dim"
                          )}
                        >
                          {isOverdue ? "已逾期 · " : ""}
                          {item.task.dueAt.toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/collections?taskId=${item.task.id}`}
                      className="shrink-0 rounded bg-primary px-2 py-1 text-xs font-[510] text-white hover:bg-accent transition-colors"
                    >
                      去填写
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </ContentCard>

        {/* 最近使用 */}
        <ContentCard>
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[13px] font-[510] text-foreground">
              最近使用
            </span>
            <Link
              href="/records"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              查看全部
            </Link>
          </div>
          {recentItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Clock className="mb-2 h-8 w-8 opacity-40" />
              <p className="text-sm">暂无记录</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentItems.slice(0, 5).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded",
                        item.kind === "report"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-primary/15 text-accent"
                      )}
                    >
                      {item.kind === "report" ? (
                        <PenLine className="h-3 w-3" />
                      ) : (
                        <FileText className="h-3 w-3" />
                      )}
                    </div>
                    <span className="truncate text-[13px] font-[510] text-foreground">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-text-dim">
                      {formatRelativeTime(item.time)}
                    </span>
                    <Link
                      href={item.href}
                      className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      继续
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ContentCard>
      </div>

      {/* ---- Row 3: Team Activity + Monthly Stats ---- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        {/* 团队动态 */}
        <ContentCard>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-[510] text-foreground">
                团队动态
              </span>
            </div>
            {isAdmin && (
              <Link
                href="/records"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                查看全部
              </Link>
            )}
          </div>
          {teamActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Users className="mb-2 h-8 w-8 opacity-40" />
              <p className="text-sm">暂无团队动态</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {teamActivity.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-[510] text-primary">
                      {record.user.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-foreground">
                        <span className="font-[510]">{record.user.name}</span>
                        <span className="mx-1 text-muted-foreground">
                          填写了
                        </span>
                        <span className="font-[510]">{record.template.name}</span>
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-text-dim">
                    {formatRelativeTime(record.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ContentCard>

        {/* 本月统计 */}
        <ContentCard>
          <div className="mb-4">
            <span className="text-[13px] font-[510] text-foreground">
              本月统计
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <StatItem
              icon={FileText}
              label="可用模板"
              value={publishedTemplates}
            />
            <StatItem
              icon={BarChart3}
              label="本月生成"
              value={monthlyRecords}
            />
            <StatItem icon={PenLine} label="我的草稿" value={drafts} />
            <StatItem
              icon={AlertCircle}
              label="待办事项"
              value={pendingCount}
            />
          </div>
        </ContentCard>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small inline components                                            */
/* ------------------------------------------------------------------ */

function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-md bg-white/[0.04] p-3">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <div className="text-lg font-[510] leading-tight text-foreground">
          {value}
        </div>
        <div className="text-xs text-text-dim">{label}</div>
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
