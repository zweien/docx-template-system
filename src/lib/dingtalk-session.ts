import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { Role } from "@/generated/prisma/enums";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, matches NextAuth default

function getBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || "http://localhost:8060").replace(
    /\/$/,
    ""
  );
}

function getSessionCookieName(): string {
  return "next-auth.session-token";
}

interface SessionUser {
  id: string;
  role: Role;
  name: string;
  email: string;
}

export async function createSessionResponse(
  user: SessionUser,
  redirectUrl: string
) {
  const sessionToken = await encode({
    token: {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    },
    secret: process.env.NEXTAUTH_SECRET!,
    maxAge: SESSION_MAX_AGE,
  });

  const response = NextResponse.redirect(new URL(redirectUrl, getBaseUrl()), 302);
  response.cookies.set(getSessionCookieName(), sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}

export async function createSessionJsonResponse(user: SessionUser) {
  const sessionToken = await encode({
    token: {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    },
    secret: process.env.NEXTAUTH_SECRET!,
    maxAge: SESSION_MAX_AGE,
  });

  const response = NextResponse.json({ success: true, redirect: "/" });
  response.cookies.set(getSessionCookieName(), sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}
