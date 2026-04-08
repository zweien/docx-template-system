import { db } from "@/lib/db";
import { GeneratePageClient } from "./generate-page-client";

export default async function GeneratePage() {
  const [categories, allTags, templates] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.template.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        name: true,
        screenshot: true,
        categoryId: true,
        createdAt: true,
        category: { select: { name: true } },
        tags: { select: { tag: { select: { id: true, name: true } } } },
        currentVersion: { select: { version: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <GeneratePageClient
      templates={templates.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))}
      categories={categories}
      allTags={allTags}
    />
  );
}
