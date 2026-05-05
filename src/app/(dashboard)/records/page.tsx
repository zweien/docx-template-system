import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Download,
  History,
} from "lucide-react";
import type { Role, RecordStatus } from "@/generated/prisma/enums";
import { PageHeader, ContentCard, EmptyState } from "@/components/shared";

const STATUS_LABELS: Record<RecordStatus, string> = {
  PENDING: "待生成",
  COMPLETED: "已完成",
  FAILED: "失败",
};

const STATUS_VARIANTS: Record<
  RecordStatus,
  "secondary" | "default" | "destructive"
> = {
  PENDING: "secondary",
  COMPLETED: "default",
  FAILED: "destructive",
};

const STATUS_BADGE_CLASS: Record<RecordStatus, string> = {
  PENDING: "border-border bg-muted text-foreground",
  COMPLETED: "bg-primary text-primary-foreground",
  FAILED: "bg-destructive text-destructive-foreground",
};

const STATUS_TABS: { label: string; value: string }[] = [
  { label: "全部", value: "" },
  { label: "待生成", value: "PENDING" },
  { label: "已完成", value: "COMPLETED" },
  { label: "失败", value: "FAILED" },
];

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  const page = Number(params.page) || 1;
  const pageSize = 20;
  const status = params.status;
  const isAdmin = (session?.user?.role as Role) === "ADMIN";

  // Build where clause: ADMIN sees all, regular users see only their own
  const where: Record<string, unknown> = {};
  if (!isAdmin && session?.user?.id) {
    where.userId = session.user.id;
  }
  if (status && ["PENDING", "COMPLETED", "FAILED"].includes(status)) {
    where.status = status;
  }

  const [records, total] = await Promise.all([
    db.record.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { template: { select: { name: true } } },
    }),
    db.record.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  function buildUrl(pageNum: number, statusFilter: string) {
    const searchParams = new URLSearchParams();
    if (pageNum > 1) searchParams.set("page", String(pageNum));
    if (statusFilter) searchParams.set("status", statusFilter);
    const qs = searchParams.toString();
    return `/records${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="生成记录"
        description={`共 ${total} 条记录`}
        actions={
          <a
            href="/api/records/export"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 h-9 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            <Download className="h-4 w-4" />
            导出
          </a>
        }
      />

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1">
        {STATUS_TABS.map((tab) => {
          const isActive = (status || "") === tab.value;
          return (
            <Link
              key={tab.value}
              href={buildUrl(1, tab.value)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-[510] transition-colors ${
                isActive
                  ? "bg-accent/20 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <ContentCard className="!p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">模板名称</TableHead>
              <TableHead className="w-[160px]">生成时间</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead>文件名</TableHead>
              <TableHead className="w-[160px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    icon={History}
                    title="暂无生成记录"
                    description="填写模板表单即可生成文档"
                    action={
                      <LinkButton variant="link" size="sm" href="/templates">
                        前往模板列表填写表单
                      </LinkButton>
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-[510] text-foreground">
                    {record.template.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {record.createdAt.toLocaleDateString("zh-CN", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={STATUS_VARIANTS[record.status as RecordStatus]}
                      className={STATUS_BADGE_CLASS[record.status as RecordStatus]}
                    >
                      {STATUS_LABELS[record.status as RecordStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {record.fileName || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {record.status === "COMPLETED" && record.fileName && (
                        <a
                          href={`/api/records/${record.id}/download`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-[510] text-foreground/90 transition-colors hover:text-foreground"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <LinkButton
                        variant="ghost"
                        size="sm"
                        className="text-foreground hover:text-foreground"
                        href={`/records/${record.id}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        查看
                      </LinkButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ContentCard>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            第 {page} 页，共 {totalPages} 页
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <LinkButton
                variant="outline"
                size="sm"
                className="text-foreground"
                href={buildUrl(page - 1, status || "")}
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </LinkButton>
            ) : (
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft className="h-4 w-4" />
                上一页
              </Button>
            )}
            {page < totalPages ? (
              <LinkButton
                variant="outline"
                size="sm"
                className="text-foreground"
                href={buildUrl(page + 1, status || "")}
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </LinkButton>
            ) : (
              <Button variant="outline" size="sm" disabled>
                下一页
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
