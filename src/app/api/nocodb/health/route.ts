import { NextResponse } from "next/server";
import { healthCheck } from "@/lib/nocodb";

export async function GET() {
  const ok = await healthCheck();
  return NextResponse.json({
    connected: ok,
    url: process.env.NOCODB_URL || "http://localhost:8040",
  });
}
