import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listTables } from "@/lib/nocodb";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tables = await listTables();
    return NextResponse.json({ data: tables });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: { code: "NOCODB_ERROR", message } },
      { status: 502 }
    );
  }
}
