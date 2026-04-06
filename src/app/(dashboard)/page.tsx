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

  const [publishedTemplates, totalTemplates, monthlyRecords, drafts, totalUsers, todayRecords] =
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
    ]);

  const stats = isAdmin
    ? [
        { label: "可用模板", value: publishedTemplates, icon: CheckCircle, iconColor: "text-green-500", href: "/generate" },
        { label: "模板总数", value: totalTemplates, icon: FileText, iconColor: "text-blue-500", href: "/templates" },
        { label: "总用户数", value: totalUsers, icon: Users, iconColor: "text-indigo-500", href: "/admin/users" },
        { label: "今日生成", value: todayRecords, icon: History, iconColor: "text-orange-500", href: "/records" },
      ]
    : [
        { label: "可用模板", value: publishedTemplates, icon: CheckCircle, iconColor: "text-green-500", href: "/generate" },
        { label: "本月生成", value: monthlyRecords, icon: History, iconColor: "text-orange-500", href: "/records" },
        { label: "我的草稿", value: drafts, icon: PenLine, iconColor: "text-purple-500", href: "/drafts" },
      ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">仪表盘</h1>
        <p className="text-muted-foreground">
          欢迎回来，{session?.user?.name ?? "用户"}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="hover:border-zinc-400 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <Icon className={`h-4 w-4 ${stat.iconColor}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
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
