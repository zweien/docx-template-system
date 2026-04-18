import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  q: z.string().min(1).max(100),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({ q: searchParams.get("q") || "" });
  if (!parsed.success) {
    return NextResponse.json({ items: [] });
  }

  const { q } = parsed.data;

  const users = await db.user.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true },
    take: 10,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ items: users });
}
