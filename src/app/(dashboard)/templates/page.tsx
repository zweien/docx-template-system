import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button, LinkButton } from "@/components/ui/button";
import { Upload, ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { Role, TemplateStatus } from "@/generated/prisma/enums";
import { CategoryTagManagerButton } from "@/components/templates/category-tag-manager-button";
import { TemplateTableWithBatch } from "@/components/templates/template-table-with-batch";
import { PageHeader, ContentCard } from "@/components/shared";

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
          <div className="flex items-center gap-2">
            <a
              href="/api/templates/export"
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 h-9 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              <Download className="h-4 w-4" />
              导出
            </a>
            {isAdmin && (
              <>
                <CategoryTagManagerButton />
                <LinkButton href="/templates/new">
                  <Upload className="h-4 w-4" />
                  上传模板
                </LinkButton>
              </>
            )}
          </div>
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
        <TemplateTableWithBatch
          templates={templates}
          categories={categories}
          isAdmin={isAdmin}
        />
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
