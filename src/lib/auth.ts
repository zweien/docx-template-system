import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { signIn, signOut } from "next-auth/react";
import type { NextRequest } from "next/server";
import type { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth-options";

export { signIn, signOut };

export interface RouteSessionUser {
  id: string;
  role: Role;
  name?: string | null;
  email?: string | null;
}

export async function auth(
  ...args: Parameters<typeof getServerSession>
) {
  const session = await getServerSession(
    ...(args.length === 0
      ? [authOptions]
      : args)
  );
  return session;
}

export async function getRouteSessionUser(
  request: NextRequest
): Promise<RouteSessionUser | null> {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.id || !token.role) {
    return null;
  }

  return {
    id: String(token.id),
    role: token.role as Role,
    name: token.name,
    email: token.email,
  };
}

export { getServerSession };
