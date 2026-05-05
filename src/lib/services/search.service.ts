import { db } from "@/lib/db";
import type { ServiceResult } from "@/types/data-table";

const SEARCHABLE_FIELD_TYPES = new Set([
  "TEXT", "EMAIL", "SELECT", "PHONE", "URL", "MULTISELECT",
]);

export interface SearchResultItem {
  id: string;
  data: Record<string, unknown>;
  matchedFields: string[];
}

export interface SearchTableResult {
  tableId: string;
  tableName: string;
  tableIcon: string | null;
  records: SearchResultItem[];
  hasMore: boolean;
}

export async function globalSearch(
  query: string,
  limit: number = 5
): Promise<ServiceResult<SearchTableResult[]>> {
  try {
    const tables = await db.dataTable.findMany({
      include: { fields: true },
      orderBy: { updatedAt: "desc" },
    });

    const results: SearchTableResult[] = [];

    for (const table of tables) {
      const searchFields = table.fields
        .filter((f) => SEARCHABLE_FIELD_TYPES.has(f.type))
        .map((f) => f.key);

      if (searchFields.length === 0) continue;

      const orConditions = searchFields.map((fieldKey) => ({
        data: { path: [fieldKey], string_contains: query },
      }));

      const matchingRecords = await db.dataRecord.findMany({
        where: { tableId: table.id, OR: orConditions },
        take: limit + 1,
        orderBy: { updatedAt: "desc" },
      });

      if (matchingRecords.length === 0) continue;

      const hasMore = matchingRecords.length > limit;
      const records = matchingRecords.slice(0, limit).map((record) => {
        const data = record.data as Record<string, unknown>;
        const matchedFields = searchFields.filter((key) => {
          const val = data[key];
          return typeof val === "string" && val.toLowerCase().includes(query.toLowerCase());
        });
        return { id: record.id, data, matchedFields };
      });

      results.push({
        tableId: table.id,
        tableName: table.name,
        tableIcon: table.icon,
        records,
        hasMore,
      });

      if (results.length >= 10) break;
    }

    return { success: true, data: results };
  } catch (error) {
    return {
      success: false,
      error: { code: "SEARCH_ERROR", message: error instanceof Error ? error.message : "搜索失败" },
    };
  }
}

export interface TemplateSearchItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  categoryName: string | null;
}

export async function searchTemplates(
  query: string,
  limit: number = 5,
  isAdmin: boolean = false
): Promise<ServiceResult<TemplateSearchItem[]>> {
  try {
    const templates = await db.template.findMany({
      where: {
        ...(!isAdmin ? { status: "PUBLISHED" } : {}),
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { tags: { some: { tag: { name: { contains: query, mode: "insensitive" } } } } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        category: { select: { name: true } },
      },
    });
    return {
      success: true,
      data: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        status: t.status,
        categoryName: t.category?.name ?? null,
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: { code: "SEARCH_TEMPLATES_ERROR", message: error instanceof Error ? error.message : "搜索模板失败" },
    };
  }
}

export interface RecordSearchItem {
  id: string;
  fileName: string | null;
  templateName: string;
  status: string;
  createdAt: string;
}

export async function searchRecords(
  query: string,
  limit: number = 5,
  userId?: string,
  isAdmin: boolean = false
): Promise<ServiceResult<RecordSearchItem[]>> {
  try {
    const records = await db.record.findMany({
      where: {
        ...(!isAdmin && userId ? { userId } : {}),
        OR: [
          { fileName: { contains: query, mode: "insensitive" } },
          { template: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        status: true,
        createdAt: true,
        template: { select: { name: true } },
      },
    });
    return {
      success: true,
      data: records.map((r) => ({
        id: r.id,
        fileName: r.fileName,
        templateName: r.template.name,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: { code: "SEARCH_RECORDS_ERROR", message: error instanceof Error ? error.message : "搜索记录失败" },
    };
  }
}

export interface CollectionTaskSearchItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
}

export async function searchCollectionTasks(
  query: string,
  limit: number = 5
): Promise<ServiceResult<CollectionTaskSearchItem[]>> {
  try {
    const tasks = await db.documentCollectionTask.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { instruction: { contains: query, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        instruction: true,
        status: true,
      },
    });
    return {
      success: true,
      data: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.instruction,
        status: t.status,
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: { code: "SEARCH_COLLECTIONS_ERROR", message: error instanceof Error ? error.message : "搜索收集任务失败" },
    };
  }
}

export interface ReportTemplateSearchItem {
  id: string;
  name: string;
  originalFilename: string;
}

export async function searchReportTemplates(
  query: string,
  limit: number = 5
): Promise<ServiceResult<ReportTemplateSearchItem[]>> {
  try {
    const templates = await db.reportTemplate.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { originalFilename: { contains: query, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        originalFilename: true,
      },
    });
    return {
      success: true,
      data: templates.map((t) => ({
        id: t.id,
        name: t.name,
        originalFilename: t.originalFilename,
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: { code: "SEARCH_REPORTS_ERROR", message: error instanceof Error ? error.message : "搜索报告模板失败" },
    };
  }
}

export interface UnifiedSearchResult {
  templates: TemplateSearchItem[];
  records: RecordSearchItem[];
  dataRecords: SearchTableResult[];
  collectionTasks: CollectionTaskSearchItem[];
  reportTemplates: ReportTemplateSearchItem[];
}

export async function unifiedSearch(
  query: string,
  limit: number = 5,
  userId?: string,
  isAdmin: boolean = false
): Promise<ServiceResult<UnifiedSearchResult>> {
  const [templatesRes, recordsRes, dataRecordsRes, collectionsRes, reportsRes] = await Promise.all([
    searchTemplates(query, limit, isAdmin),
    searchRecords(query, limit, userId, isAdmin),
    globalSearch(query, limit),
    searchCollectionTasks(query, limit),
    searchReportTemplates(query, limit),
  ]);

  return {
    success: true,
    data: {
      templates: templatesRes.success ? templatesRes.data : [],
      records: recordsRes.success ? recordsRes.data : [],
      dataRecords: dataRecordsRes.success ? dataRecordsRes.data : [],
      collectionTasks: collectionsRes.success ? collectionsRes.data : [],
      reportTemplates: reportsRes.success ? reportsRes.data : [],
    },
  };
}
