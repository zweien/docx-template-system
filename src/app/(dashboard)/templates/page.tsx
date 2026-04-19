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
import { Upload, ChevronLeft, ChevronRight, Pencil, Eye, FileText } from "lucide-react";
import type { Role, TemplateStatus } from "@/generated/prisma/enums";
import { TemplateListDeleteButton } from "./template-list-delete-button";
import { CategoryTagManagerButton } from "@/components/templates/category-tag-manager-button";

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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.02)] p-5 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.03)]">
        <div>
          <h1 className="text-3xl font-[510] tracking-[-0.7px] text-[#f7f8f8]">模板管理</h1>
          <p className="text-sm text-[#8a8f98]">
            共 {total} 个模板
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <CategoryTagManagerButton />
            <Button nativeButton={false} render={<Link href="/templates/new" />}>
              <Upload className="h-4 w-4" />
              上传模板
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-md border border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.02)] p-1">
        {STATUS_TABS.map((tab) => {
          const isActive = (status || "") === tab.value;
          return (
            <Link
              key={tab.value}
              href={buildUrl(1, tab.value, categoryId)}
              className={`shrink-0 rounded-md px-4 py-2 text-sm font-[510] transition-colors ${
                isActive
                  ? "bg-[rgb(113_112_255_/_0.18)] text-[#f7f8f8]"
                  : "text-[#8a8f98] hover:bg-[rgb(255_255_255_/_0.04)] hover:text-[#f7f8f8]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {categories.length > 0 && (
        <div className="flex gap-1 overflow-x-auto rounded-md border border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.02)] p-1">
          <Link
            href={buildUrl(1, status || "")}
            className={`shrink-0 rounded-md border px-3 py-1.5 text-sm font-[510] transition-colors ${
              !categoryId
                ? "border-[rgb(255_255_255_/_0.1)] bg-[rgb(113_112_255_/_0.18)] text-[#f7f8f8]"
                : "border-[rgb(255_255_255_/_0.08)] text-[#8a8f98] hover:text-[#f7f8f8]"
            }`}
          >
            全部
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={buildUrl(1, status || "", cat.id)}
              className={`shrink-0 rounded-md border px-3 py-1.5 text-sm font-[510] transition-colors ${
                categoryId === cat.id
                  ? "border-[rgb(255_255_255_/_0.1)] bg-[rgb(113_112_255_/_0.18)] text-[#f7f8f8]"
                  : "border-[rgb(255_255_255_/_0.08)] text-[#8a8f98] hover:text-[#f7f8f8]"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      )}

      <div>
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
                <TableCell
                  colSpan={8}
                  className="h-32"
                >
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <FileText className="h-8 w-8 mb-2" />
                    <p className="text-sm">暂无模板数据</p>
                    {isAdmin && (
                      <Button
                        variant="link"
                        size="sm"
                        nativeButton={false}
                        render={<Link href="/templates/new" />}
                      >
                        上传第一个模板
                      </Button>
                    )}
                  </div>
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
                  <TableCell className="font-[510] text-[#f7f8f8]">{template.name}</TableCell>
                  <TableCell className="text-[#8a8f98]">
                    {template.currentVersion ? `v${template.currentVersion.version}` : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {template.tags.length === 0 ? (
                        <span className="text-xs text-[#62666d]">—</span>
                      ) : (
                        <>
                          {template.tags.slice(0, 3).map((t) => (
                            <Badge key={t.tag.id} variant="outline" className="text-xs">
                              {t.tag.name}
                            </Badge>
                          ))}
                          {template.tags.length > 3 && (
                            <span className="text-xs text-[#62666d]">+{template.tags.length - 3}</span>
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
                  <TableCell className="text-[#8a8f98]">
                    {template.createdBy.name}
                  </TableCell>
                  <TableCell className="text-[#8a8f98]">
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
                        className="text-[#8a8f98] hover:text-[#f7f8f8]"
                        nativeButton={false}
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
                            className="text-[#8a8f98] hover:text-[#f7f8f8]"
                            render={
                              <Link
                                href={`/templates/${template.id}/edit`}
                              />
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">编辑</span>
                          </Button>
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
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#8a8f98]">
            第 {page} 页，共 {totalPages} 页
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={buildUrl(page - 1, status || "", categoryId)} />}
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
                nativeButton={false}
                render={<Link href={buildUrl(page + 1, status || "", categoryId)} />}
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
