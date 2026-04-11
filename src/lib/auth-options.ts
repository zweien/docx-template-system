import type { NextAuthOptions } from "next-auth";
import AuthentikProvider from "next-auth/providers/authentik";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import { getAuthentikConfig } from "@/lib/authentik";
import { syncOidcUser } from "@/lib/oidc-user-sync";
import { logAudit } from "@/lib/services/audit-log.service";

const authentikConfig = getAuthentikConfig();

export const authOptions: NextAuthOptions = {
  providers: [
    AuthentikProvider({
      issuer: authentikConfig.issuer,
      clientId: authentikConfig.clientId,
      clientSecret: authentikConfig.clientSecret,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "authentik") {
        return false;
      }

      return Boolean(profile?.sub && profile.email);
    },
    async jwt({ token, account, profile }) {
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
