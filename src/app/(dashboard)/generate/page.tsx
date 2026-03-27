import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, FileOutput, Search } from "lucide-react";

function buildUrl(overrides: { categoryId?: string; tagIds?: string[]; search?: string }) {
  const params = new URLSearchParams();
  if (overrides.categoryId) params.set("categoryId", overrides.categoryId);
  if (overrides.tagIds && overrides.tagIds.length > 0) params.set("tagIds", overrides.tagIds.join(","));
  if (overrides.search) params.set("search", overrides.search);
  const qs = params.toString();
  return `/generate${qs ? `?${qs}` : ""}`;
}

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; categoryId?: string; tagIds?: string; search?: string }>;
}) {
  const params = await searchParams;
  const categoryId = params.categoryId;
  const tagIdsParam = params.tagIds;
  const search = params.search;
  const tagIds = tagIdsParam ? tagIdsParam.split(",").filter(Boolean) : [];

  const [categories, allTags] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const where: Record<string, unknown> = { status: "PUBLISHED" };
  if (categoryId) where.categoryId = categoryId;
  if (tagIds.length > 0) where.tags = { some: { tagId: { in: tagIds } } };
  if (search) where.name = { contains: search, mode: "insensitive" };

  const templates = await db.template.findMany({
    where,
    select: {
      id: true,
      name: true,
      originalFileName: true,
      createdAt: true,
      category: { select: { name: true } },
      tags: { select: { tag: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">生成文档</h1>
        <p className="text-muted-foreground">
          选择一个模板，填写内容后即可生成文档
        </p>
      </div>

      {/* Search */}
      <form action="/generate" method="get" className="relative">
        {categoryId && <input type="hidden" name="categoryId" value={categoryId} />}
        {tagIds.length > 0 && <input type="hidden" name="tagIds" value={tagIds.join(",")} />}
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          name="search"
          defaultValue={search}
          placeholder="搜索模板..."
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </form>

      {/* Category tabs */}
      {categories.length > 0 && (
        <div className="flex gap-1 overflow-x-auto">
          <Link
            href={buildUrl({ categoryId: undefined, tagIds, search })}
            className={`shrink-0 px-3 py-1.5 text-sm rounded-md border transition-colors ${
              !categoryId
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            全部
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={buildUrl({ categoryId: cat.id, tagIds, search })}
              className={`shrink-0 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                categoryId === cat.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      )}

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="flex gap-1 overflow-x-auto">
          {allTags.map((tag) => {
            const isSelected = tagIds.includes(tag.id);
            const newTagIds = isSelected
              ? tagIds.filter((id) => id !== tag.id)
              : [...tagIds, tag.id];
            return (
              <Link
                key={tag.id}
                href={buildUrl({ categoryId, tagIds: newTagIds, search })}
                className={`shrink-0 px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                }`}
              >
                {tag.name}
              </Link>
            );
          })}
        </div>
      )}

      {/* Empty state: no templates at all (no filters active) */}
      {templates.length === 0 && !search && !categoryId && tagIds.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <FileOutput className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">暂无可用模板</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            需要先上传并配置模板后才能生成文档
          </p>
          <Link
            href="/templates"
            className="mt-4 text-sm font-medium text-primary hover:underline"
          >
            前往模板管理
          </Link>
        </div>
      ) : templates.length === 0 ? null : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {templates.map((t) => (
            <Link key={t.id} href={`/templates/${t.id}/fill`}>
              <Card className="h-full transition-colors hover:bg-accent cursor-pointer">
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <h3 className="font-semibold leading-tight truncate">
                        {t.name}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {t.originalFileName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end text-xs text-muted-foreground">
                    <span>{t.createdAt.toLocaleDateString("zh-CN")}</span>
                  </div>
                  {t.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {t.tags.slice(0, 3).map((tt) => (
                        <Badge key={tt.tag.id} variant="secondary" className="text-xs">
                          {tt.tag.name}
                        </Badge>
                      ))}
                      {t.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{t.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Empty results with active filters */}
      {(search || categoryId || tagIds.length > 0) && templates.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <Search className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">没有找到匹配的模板</p>
          <Link href="/generate" className="mt-2 text-sm font-medium text-primary hover:underline">
            清除筛选条件
          </Link>
        </div>
      )}
    </div>
  );
}
