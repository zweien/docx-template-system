import { NextRequest, NextResponse } from "next/server";
import { getRouteSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/services/audit-log.service";
import { getClientIp, getUserAgent } from "@/lib/request-utils";

export async function POST(request: NextRequest) {
  const user = await getRouteSessionUser(request);
  if (user) {
    await logAudit({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: "LOGOUT",
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });
  }
  return NextResponse.json({ success: true });
}
