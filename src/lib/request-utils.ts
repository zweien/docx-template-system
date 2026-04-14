import type { NextRequest } from "next/server";

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function getUserAgent(request: NextRequest): string {
  return request.headers.get("user-agent") ?? "unknown";
}
