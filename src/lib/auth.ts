import { getServerSession } from "next-auth";
import { signIn, signOut } from "next-auth/react";
import { authOptions } from "@/lib/auth-options";

export { signIn, signOut };

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

export { getServerSession };
