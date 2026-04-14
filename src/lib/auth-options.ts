import type { NextAuthOptions } from "next-auth";
import AuthentikProvider from "next-auth/providers/authentik";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import { getAuthentikConfig } from "@/lib/authentik";
import { syncOidcUser } from "@/lib/oidc-user-sync";
import { logAudit } from "@/lib/services/audit-log.service";

const devBypassAuth = process.env.DEV_BYPASS_AUTH === "true";

// Hard guard: refuse to enable bypass auth outside development
if (devBypassAuth && process.env.NODE_ENV === "production") {
  throw new Error(
    "FATAL: DEV_BYPASS_AUTH is enabled in production. " +
    "This is a security risk and the server will not start. " +
    "Remove DEV_BYPASS_AUTH from your environment variables."
  );
}

const authentikConfig = getAuthentikConfig();

export const authOptions: NextAuthOptions = {
  providers: [
    AuthentikProvider({
      issuer: authentikConfig.issuer,
      clientId: authentikConfig.clientId,
      clientSecret: authentikConfig.clientSecret,
    }),
    ...(devBypassAuth
      ? [
          CredentialsProvider({
            id: "dev-credentials",
            name: "Dev Login",
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
              if (!credentials?.email || !credentials?.password) return null;

              const user = await db.user.findUnique({
                where: { email: credentials.email },
              });
              if (!user || !user.password) return null;

              const valid = await compare(credentials.password, user.password);
              if (!valid) return null;

              return {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
              };
            },
          }),
        ]
      : []),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider === "dev-credentials") {
        return true;
      }

      if (account?.provider !== "authentik") {
        return false;
      }

      return Boolean(profile?.sub && profile.email);
    },
    async jwt({ token, account, profile, user }) {
      if (account?.provider === "dev-credentials" && user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
        token.name = user.name;
        token.email = user.email;

        logAudit({
          userId: user.id,
          userName: user.name ?? "",
          userEmail: user.email ?? "",
          action: "LOGIN",
        });
      }

      if (account?.provider === "authentik" && profile?.sub && profile.email) {
        const defaultRole: Role = authentikConfig.adminEmails.has(
          String(profile.email).toLowerCase()
        )
          ? "ADMIN"
          : "USER";

        const localUser = await syncOidcUser(
          {
            findByOidcSubject(subject) {
              return db.user.findUnique({
                where: { oidcSubject: subject },
              });
            },
            findByEmail(email) {
              return db.user.findUnique({
                where: { email },
              });
            },
            update(id, data) {
              return db.user.update({
                where: { id },
                data,
              });
            },
            create(data) {
              return db.user.create({
                data,
              });
            },
          },
          {
            sub: String(profile.sub),
            email: String(profile.email),
            name: profile.name ? String(profile.name) : undefined,
          },
          defaultRole
        );

        token.id = localUser.id;
        token.role = localUser.role;
        token.name = localUser.name;
        token.email = localUser.email;
        token.oidcSubject = localUser.oidcSubject ?? undefined;

        logAudit({
          userId: localUser.id,
          userName: localUser.name,
          userEmail: String(profile.email),
          action: "LOGIN",
        });
      }

      if (account?.id_token) {
        token.idToken = account.id_token;
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
};
