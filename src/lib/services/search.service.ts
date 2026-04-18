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
