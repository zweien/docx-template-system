import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const SEARCHABLE_FIELD_TYPES = new Set([
  "TEXT", "EMAIL", "SELECT", "PHONE", "URL",
]);

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "5", 10), 20);

  // Fetch all tables with their fields
  const tables = await db.dataTable.findMany({
    include: { fields: true },
    orderBy: { updatedAt: "desc" },
  });

  const results: Array<{
    tableId: string;
    tableName: string;
    tableIcon: string | null;
    records: Array<{
      id: string;
      data: Record<string, unknown>;
      matchedFields: string[];
    }>;
    totalMatches: number;
  }> = [];

  for (const table of tables) {
    const searchFields = table.fields
      .filter((f) => SEARCHABLE_FIELD_TYPES.has(f.type))
      .map((f) => f.key);

    if (searchFields.length === 0) continue;

    const orConditions = searchFields.map((fieldKey) => ({
      data: { path: [fieldKey], string_contains: q },
    }));

    const matchingRecords = await db.dataRecord.findMany({
      where: {
        tableId: table.id,
        OR: orConditions,
      },
      take: limit + 1,
      orderBy: { updatedAt: "desc" },
    });

    if (matchingRecords.length === 0) continue;

    const records = matchingRecords.slice(0, limit).map((record) => {
      const data = record.data as Record<string, unknown>;
      const matchedFields = searchFields.filter((key) => {
        const val = data[key];
        return typeof val === "string" && val.toLowerCase().includes(q.toLowerCase());
      });
      return { id: record.id, data, matchedFields };
    });

    results.push({
      tableId: table.id,
      tableName: table.name,
      tableIcon: table.icon,
      records,
      totalMatches: matchingRecords.length > limit ? matchingRecords.length : records.length,
    });

    if (results.length >= 10) break;
  }

  return NextResponse.json({ results });
}
