import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, ChevronLeft, ChevronRight, Settings, Trash2, Eye } from "lucide-react";
import type { Role, TemplateStatus } from "@/generated/prisma/enums";

const STATUS_LABELS: Record<TemplateStatus, string> = {
  DRAFT: "草稿",
  READY: "可用",
  ARCHIVED: "已归档",
};

const STATUS_VARIANTS: Record<
  TemplateStatus,
  "secondary" | "default" | "destructive"
> = {
  DRAFT: "secondary",
  READY: "default",
  ARCHIVED: "destructive",
};

const STATUS_TABS: { label: string; value: string }[] = [
  { label: "全部", value: "" },
  { label: "草稿", value: "DRAFT" },
  { label: "可用", value: "READY" },
  { label: "已归档", value: "ARCHIVED" },
];

export default async function TemplatesPage({
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

  const where = status ? { status: status as TemplateStatus } : {};

  const [templates, total] = await Promise.all([
    db.template.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        fileName: true,
        status: true,
        createdAt: true,
        createdBy: {
          select: { name: true },
        },
      },
    }),
    db.template.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  function buildUrl(pageNum: number, statusFilter: string) {
    const searchParams = new URLSearchParams();
    if (pageNum > 1) searchParams.set("page", String(pageNum));
    if (statusFilter) searchParams.set("status", statusFilter);
    const qs = searchParams.toString();
    return `/templates${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">模板管理</h1>
          <p className="text-muted-foreground">
            共 {total} 个模板
          </p>
        </div>
        {isAdmin && (
          <Button render={<Link href="/templates/new" />}>
            <Upload className="h-4 w-4" />
            上传模板
          </Button>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1 border-b">
        {STATUS_TABS.map((tab) => {
          const isActive = (status || "") === tab.value;
          return (
            <Link
              key={tab.value}
              href={buildUrl(1, tab.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">名称</TableHead>
              <TableHead>文件名</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead className="w-[100px]">创建者</TableHead>
              <TableHead className="w-[160px]">创建时间</TableHead>
              <TableHead className="w-[160px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  暂无模板数据
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {template.fileName}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[template.status]}>
                      {STATUS_LABELS[template.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {template.createdBy.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {template.createdAt.toLocaleDateString("zh-CN", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        render={<Link href={`/templates/${template.id}`} />}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span className="sr-only">查看</span>
                      </Button>
                      {isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            render={
                              <Link
                                href={`/templates/${template.id}/configure`}
                              />
                            }
                          >
                            <Settings className="h-3.5 w-3.5" />
                            <span className="sr-only">配置</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">删除</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            第 {page} 页，共 {totalPages} 页
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button
                variant="outline"
                size="sm"
                render={<Link href={buildUrl(page - 1, status || "")} />}
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft className="h-4 w-4" />
                上一页
              </Button>
            )}
            {page < totalPages ? (
              <Button
                variant="outline"
                size="sm"
                render={<Link href={buildUrl(page + 1, status || "")} />}
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </Button>
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
