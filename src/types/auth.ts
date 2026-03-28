import type { DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user?: {
      id: string;
      role: Role;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: Role;
    oidcSubject?: string;
    idToken?: string;
  }
}
