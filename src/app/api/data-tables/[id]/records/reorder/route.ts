import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { db } from "@/lib/db";
import { toJsonInput } from "@/lib/services/data-record.service";

const reorderSchema = z.object({
  recordIds: z.array(z.string()).min(1).max(200),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/data-tables/[id]/records/reorder
 *
 * Updates the manual sort order in the current view's viewOptions.
 * Uses gap algorithm (0, 1000, 2000...) to minimize reorder operations.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { id: tableId } = await params;

  try {
    const body = await request.json();
    const { recordIds } = reorderSchema.parse(body);

    // Get viewId from query params
    const viewId = request.nextUrl.searchParams.get("viewId");
    if (!viewId) {
      return NextResponse.json({ error: "需要指定 viewId" }, { status: 400 });
    }

    // Verify view exists and belongs to this table
    const view = await db.dataView.findUnique({ where: { id: viewId } });
    if (!view || view.tableId !== tableId) {
      return NextResponse.json({ error: "视图不存在" }, { status: 404 });
    }

    // Build order map with gap algorithm
    const orders: Record<string, number> = {};
    recordIds.forEach((id, index) => {
      orders[id] = index * 1000;
    });

    // Update view's viewOptions with new manual sort order
    const existingOptions = (view.viewOptions as Record<string, unknown>) ?? {};
    const updatedOptions = {
      ...existingOptions,
      manualSort: {
        enabled: true,
        orders,
      },
    };

    await db.dataView.update({
      where: { id: viewId },
      data: {
        viewOptions: toJsonInput(updatedOptions),
      },
    });

    return NextResponse.json({ success: true, data: { reordered: recordIds.length } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "排序失败" }, { status: 500 });
  }
}
