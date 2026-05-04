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
import { Upload, ChevronLeft, ChevronRight, Pencil, Eye, FileText } from "lucide-react";
import type { Role, TemplateStatus } from "@/generated/prisma/enums";
import { TemplateListDeleteButton } from "./template-list-delete-button";
import { CategoryTagManagerButton } from "@/components/templates/category-tag-manager-button";
import { PageHeader, ContentCard, EmptyState } from "@/components/shared";

const STATUS_LABELS: Record<TemplateStatus, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
};

const STATUS_VARIANTS: Record<
  TemplateStatus,
  "secondary" | "default" | "destructive"
> = {
  DRAFT: "secondary",
  PUBLISHED: "default",
  ARCHIVED: "destructive",
};

const STATUS_TABS: { label: string; value: string }[] = [
  { label: "全部", value: "" },
  { label: "草稿", value: "DRAFT" },
  { label: "已发布", value: "PUBLISHED" },
  { label: "已归档", value: "ARCHIVED" },
];

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; categoryId?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  const page = Number(params.page) || 1;
  const pageSize = 20;
  const status = params.status;
  const categoryId = params.categoryId;
  const isAdmin = (session?.user?.role as Role) === "ADMIN";

  const categories = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  const where = isAdmin
    ? {
        ...(status ? { status: status as TemplateStatus } : {}),
        ...(categoryId ? { categoryId } : {}),
      }
    : {
        status: "PUBLISHED" as TemplateStatus,
        ...(categoryId ? { categoryId } : {}),
      };

  const [templates, total] = await Promise.all([
    db.template.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        createdBy: {
          select: { name: true },
        },
        category: {
          select: { name: true },
        },
        tags: {
          select: {
            tag: { select: { id: true, name: true } },
          },
        },
        currentVersion: {
          select: { version: true },
        },
      },
    }),
    db.template.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  function buildUrl(pageNum: number, statusFilter: string, categoryFilter?: string) {
    const searchParams = new URLSearchParams();
    if (pageNum > 1) searchParams.set("page", String(pageNum));
    if (statusFilter) searchParams.set("status", statusFilter);
    if (categoryFilter) searchParams.set("categoryId", categoryFilter);
    const qs = searchParams.toString();
    return `/templates${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="模板管理"
        description={`共 ${total} 个模板`}
        actions={
          isAdmin ? (
            <div className="flex items-center gap-2">
              <CategoryTagManagerButton />
              <LinkButton href="/templates/new">
                <Upload className="h-4 w-4" />
                上传模板
              </LinkButton>
            </div>
          ) : undefined
        }
      />

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1">
        {STATUS_TABS.map((tab) => {
          const isActive = (status || "") === tab.value;
          return (
            <Link
              key={tab.value}
              href={buildUrl(1, tab.value, categoryId)}
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

      {categories.length > 0 && (
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1">
          <Link
            href={buildUrl(1, status || "")}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-[510] transition-colors ${
              !categoryId
                ? "bg-accent/20 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            全部
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={buildUrl(1, status || "", cat.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-[510] transition-colors ${
                categoryId === cat.id
                  ? "bg-accent/20 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      )}

      <ContentCard className="!p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">分类</TableHead>
              <TableHead className="w-[30%]">名称</TableHead>
              <TableHead>版本</TableHead>
              <TableHead className="w-[150px]">标签</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead className="w-[100px]">创建者</TableHead>
              <TableHead className="w-[160px]">创建时间</TableHead>
              <TableHead className="w-[160px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    icon={FileText}
                    title="暂无模板数据"
                    description={isAdmin ? "上传第一个模板来开始管理您的文档" : undefined}
                    action={
                      isAdmin ? (
                        <LinkButton variant="link" size="sm" href="/templates/new">
                          上传第一个模板
                        </LinkButton>
                      ) : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    {template.category ? (
                      <Badge variant="secondary">{template.category.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-[510] text-foreground">{template.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {template.currentVersion ? `v${template.currentVersion.version}` : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {template.tags.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <>
                          {template.tags.slice(0, 3).map((t) => (
                            <Badge key={t.tag.id} variant="outline" className="text-xs">
                              {t.tag.name}
                            </Badge>
                          ))}
                          {template.tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">+{template.tags.length - 3}</span>
                          )}
                        </>
                      )}
                    </div>
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
                      <LinkButton
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-foreground"
                        href={`/templates/${template.id}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span className="sr-only">查看</span>
                      </LinkButton>
                      {isAdmin && (
                        <>
                          <LinkButton
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground hover:text-foreground"
                            href={`/templates/${template.id}/edit`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">编辑</span>
                          </LinkButton>
                          <TemplateListDeleteButton
                            templateId={template.id}
                            templateName={template.name}
                          />
                        </>
                      )}
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
                href={buildUrl(page - 1, status || "", categoryId)}
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
                href={buildUrl(page + 1, status || "", categoryId)}
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
