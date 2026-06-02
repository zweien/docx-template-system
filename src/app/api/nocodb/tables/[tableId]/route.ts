import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTableDetail } from "@/lib/nocodb";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tableId } = await params;

  try {
    const table = await getTableDetail(tableId);
    return NextResponse.json({ data: table });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: { code: "NOCODB_ERROR", message } },
      { status: 502 }
    );
  }
}
