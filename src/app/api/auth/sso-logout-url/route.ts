import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

import { getAuthentikLogoutUrl } from "@/lib/authentik";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    const url = await getAuthentikLogoutUrl(
      typeof token?.idToken === "string" ? token.idToken : undefined
    );

    return NextResponse.json({ url });
  } catch (error) {
    console.error("获取统一退出地址失败:", error);
    return NextResponse.json({ url: "/login" });
  }
}
