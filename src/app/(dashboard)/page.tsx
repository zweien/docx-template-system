import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  CheckCircle,
  History,
  PenLine,
  Upload,
  Users,
  FileOutput,
  FolderInput,
  Database,
} from "lucide-react";
import type { Role } from "@/generated/prisma/enums";

export default async function DashboardPage() {
  const session = await auth();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const isAdmin = (session?.user?.role as Role) === "ADMIN";

  const [publishedTemplates, totalTemplates, monthlyRecords, drafts, totalUsers, todayRecords, activeCollections, dataTables] =
    await Promise.all([
      db.template.count({ where: { status: "PUBLISHED" } }),
      isAdmin ? db.template.count() : Promise.resolve(0),
      session?.user?.id
        ? db.record.count({
            where: {
              userId: session.user.id,
              createdAt: { gte: startOfMonth },
            },
          })
        : Promise.resolve(0),
      session?.user?.id
        ? db.draft.count({ where: { userId: session.user.id } })
        : Promise.resolve(0),
      isAdmin ? db.user.count() : Promise.resolve(0),
      isAdmin ? db.record.count({ where: { createdAt: { gte: startOfDay } } }) : Promise.resolve(0),
      db.documentCollectionTask.count({ where: { status: "ACTIVE" } }),
      db.dataTable.count(),
    ]);

  const stats = isAdmin
    ? [
        { label: "可用模板", value: publishedTemplates, icon: CheckCircle, href: "/generate" },
        { label: "模板总数", value: totalTemplates, icon: FileText, href: "/templates" },
        { label: "总用户数", value: totalUsers, icon: Users, href: "/admin/users" },
        { label: "今日生成", value: todayRecords, icon: History, href: "/records" },
        { label: "收集任务", value: activeCollections, icon: FolderInput, href: "/collections" },
        { label: "数据表", value: dataTables, icon: Database, href: "/data" },
      ]
    : [
        { label: "可用模板", value: publishedTemplates, icon: CheckCircle, href: "/generate" },
        { label: "本月生成", value: monthlyRecords, icon: History, href: "/records" },
        { label: "我的草稿", value: drafts, icon: PenLine, href: "/drafts" },
        { label: "收集任务", value: activeCollections, icon: FolderInput, href: "/collections" },
        { label: "数据表", value: dataTables, icon: Database, href: "/data" },
      ];

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-card p-5 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.03),0_12px_30px_rgb(0_0_0_/_0.18)] sm:p-6">
        <p className="text-xs font-[510] uppercase tracking-[0.14em] text-[#7170ff]">Overview</p>
        <h1 className="mt-2 text-3xl font-[510] tracking-[-0.7px] text-foreground">仪表盘</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          欢迎回来，{session?.user?.name ?? "用户"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="cursor-pointer border-border bg-card transition-[transform,border-color,background-color] duration-100 hover:-translate-y-0.5 hover:border-border-hover hover:bg-accent/70">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-[510] text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-secondary-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-[510] tracking-[-0.2px] text-foreground">{stat.value}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button nativeButton={false} render={<Link href="/generate" />}>
          <FileOutput className="h-4 w-4" />
          我要填表
        </Button>
        {isAdmin && (
          <Button nativeButton={false} render={<Link href="/templates/new" />}>
            <Upload className="h-4 w-4" />
            上传模板
          </Button>
        )}
        <Button variant="outline" nativeButton={false} render={<Link href="/templates" />}>
          <FileText className="h-4 w-4" />
          查看模板
        </Button>
      </div>
    </div>
  );
}
