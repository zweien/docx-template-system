import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listRecords, createRecord } from "@/lib/nocodb";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tableId } = await params;
  const { searchParams } = new URL(request.url);

  try {
    const result = await listRecords(tableId, {
      page: Number(searchParams.get("page") || "1"),
      pageSize: Number(searchParams.get("pageSize") || "50"),
      search: searchParams.get("search") || undefined,
      where: searchParams.get("where") || undefined,
      sort: searchParams.get("sort") || undefined,
    });
    return NextResponse.json({ data: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: { code: "NOCODB_ERROR", message } },
      { status: 502 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tableId } = await params;
  const body = await request.json();

  try {
    const record = await createRecord(tableId, body);
    return NextResponse.json({ data: record });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: { code: "NOCODB_ERROR", message } },
      { status: 502 }
    );
  }
}
