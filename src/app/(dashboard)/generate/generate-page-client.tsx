"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, FileOutput, Search } from "lucide-react";

interface TemplateItem {
  id: string;
  name: string;
  categoryId: string | null;
  createdAt: string;
  screenshot: string | null;
  category: { name: string } | null;
  tags: { tag: { id: string; name: string } }[];
  currentVersion: { version: number } | null;
}

interface GeneratePageClientProps {
  templates: TemplateItem[];
  categories: { id: string; name: string }[];
  allTags: { id: string; name: string }[];
}

export function GeneratePageClient({ templates, categories, allTags }: GeneratePageClientProps) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Handle ESC key to close lightbox
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxImage(null);
    };
    if (lightboxImage) {
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [lightboxImage]);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryId && t.categoryId !== categoryId) return false;
      if (tagIds.length > 0 && !tagIds.some((tid) => t.tags.some((tTag) => tTag.tag.id === tid)))
        return false;
      return true;
    });
  }, [templates, search, categoryId, tagIds]);

  const toggleTag = (tagId: string) => {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const hasActiveFilters = search || categoryId || tagIds.length > 0;

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索模板..."
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </div>

      {/* Category tabs */}
      {categories.length > 0 && (
        <div className="flex gap-1 overflow-x-auto">
          <button
            onClick={() => setCategoryId(null)}
            className={`shrink-0 px-3 py-1.5 text-sm rounded-md border transition-colors ${
              !categoryId
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            全部
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryId(cat.id === categoryId ? null : cat.id)}
              className={`shrink-0 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                categoryId === cat.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="flex gap-1 overflow-x-auto">
          {allTags.map((tag) => {
            const isSelected = tagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`shrink-0 px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                }`}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state: no templates at all */}
      {templates.length === 0 && !hasActiveFilters ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <FileOutput className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">暂无可用模板</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            需要先上传并配置模板后才能生成文档
          </p>
          <Link href="/templates" className="mt-4 text-sm font-medium text-primary hover:underline">
            前往模板管理
          </Link>
        </div>
      ) : filtered.length === 0 ? null : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <Link key={t.id} href={`/templates/${t.id}/fill`}>
              <Card className="transition-colors hover:bg-accent cursor-pointer">
                <CardContent className="flex items-stretch gap-4 p-4">
                  {/* 左侧：模板信息 */}
                  <div className="flex flex-col justify-center min-w-0 flex-1 gap-1.5">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <h3 className="text-base font-semibold leading-tight truncate">{t.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.currentVersion && (
                        <Badge variant="secondary" className="text-xs">
                          v{t.currentVersion.version}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(t.createdAt).toLocaleDateString("zh-CN")}
                      </span>
                    </div>
                    {t.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {t.tags.slice(0, 2).map((tt) => (
                          <Badge key={tt.tag.id} variant="secondary" className="text-xs">
                            {tt.tag.name}
                          </Badge>
                        ))}
                        {t.tags.length > 2 && (
                          <span className="text-xs text-muted-foreground">+{t.tags.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {/* 右侧：缩略图 */}
                  {t.screenshot ? (
                    <div
                      className="flex-shrink-0 w-20 cursor-pointer overflow-hidden rounded-md bg-muted/50 border"
                      onClick={(e) => {
                        e.preventDefault();
                        setLightboxImage(t.screenshot);
                      }}
                    >
                      <img
                        src={t.screenshot}
                        alt={t.name}
                        className="h-full w-full object-contain p-1"
                      />
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-20 flex items-center justify-center rounded-md bg-muted/50 border">
                      <FileText className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Empty results with active filters */}
      {hasActiveFilters && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <Search className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">没有找到匹配的模板</p>
          <button
            onClick={() => { setSearch(""); setCategoryId(null); setTagIds([]); }}
            className="mt-2 text-sm font-medium text-primary hover:underline"
          >
            清除筛选条件
          </button>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxImage(null)}
        >
          <img src={lightboxImage} alt="预览" className="max-h-[90vh] max-w-[90vw] object-contain" />
          <button
            className="absolute top-4 right-4 text-white text-2xl"
            onClick={() => setLightboxImage(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
