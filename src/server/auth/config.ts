import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq } from "drizzle-orm";
import { CredentialsSignin, type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

import { db } from "~/server/db";
import {
  accounts,
  profiles,
  sessions,
  users,
  verificationTokens,
} from "~/server/db/schema";
import {
  isEmailIdentifier,
  loginSchema,
  normalizeIdentifier,
  type Role,
} from "~/lib/domain";
import {
  clearRateLimitBuckets,
  consumeRateLimit,
  extractClientIp,
} from "~/server/rate-limit";
import { getLoginRateLimitPolicy } from "~/server/auth/admin-login-policy";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      authVersion: number;
      id: string;
      role: Role;
      username: string;
      contact?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    authVersion?: number;
    role?: Role;
    username?: string;
    contact?: string | null;
  }
}

class RateLimitedSignInError extends CredentialsSignin {
  code = "rate_limited";
}

async function findProfileForLogin(identifierRaw: string, role: Role) {
  const identifier = normalizeIdentifier(identifierRaw);

  if (isEmailIdentifier(identifier)) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, identifier),
      with: {
        credential: true,
        profile: true,
      },
    });

    if (!user?.profile || !user.credential || user.profile.role !== role) {
      return null;
    }

    return {
      authVersion: user.authVersion,
      email: user.email,
      name: user.name,
      profile: user.profile,
      passwordHash: user.credential.passwordHash,
      userId: user.id,
    };
  }

  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.username, identifier), eq(profiles.role, role)),
    with: {
      user: {
        with: {
          credential: true,
        },
      },
    },
  });

  if (!profile?.user?.credential) {
    return null;
  }

  return {
    authVersion: profile.user.authVersion,
    email: profile.user.email,
    name: profile.user.name,
    profile,
    passwordHash: profile.user.credential.passwordHash,
    userId: profile.user.id,
  };
}

export const authConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Role Credentials",
      credentials: {
        identifier: { label: "Identifier", type: "text" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" },
      },
      authorize: async (credentials, request) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const rateLimitPolicy = getLoginRateLimitPolicy(parsed.data.role);
        const identifier = normalizeIdentifier(parsed.data.identifier);
        const clientIp = extractClientIp(request.headers);
        const [byIdentifier, byIp] = await Promise.all([
          consumeRateLimit({
            action: "login:identifier",
            limit: rateLimitPolicy.identifierLimit,
            subject: `${parsed.data.role}:${identifier}`,
            windowMs: 15 * 60 * 1000,
          }),
          clientIp
            ? consumeRateLimit({
                action: "login:ip",
                limit: rateLimitPolicy.ipLimit,
                subject: clientIp,
                windowMs: 15 * 60 * 1000,
              })
            : Promise.resolve(null),
        ]);
        if (!byIdentifier.allowed || (byIp && !byIp.allowed)) {
          throw new RateLimitedSignInError();
        }

        const account = await findProfileForLogin(identifier, parsed.data.role);
        if (!account) {
          return null;
        }

        const passwordValid = await compare(parsed.data.password, account.passwordHash);
        if (!passwordValid) {
          return null;
        }

        await Promise.all([
          clearRateLimitBuckets({
            action: "login:identifier",
            subject: `${parsed.data.role}:${identifier}`,
          }),
          ...(clientIp
            ? [
                clearRateLimitBuckets({
                  action: "login:ip",
                  subject: clientIp,
                }),
              ]
            : []),
        ]);

        return {
          authVersion: account.authVersion,
          id: account.userId,
          email: account.email,
          name: account.profile.name,
          role: account.profile.role,
          username: account.profile.username,
          contact: account.profile.contact,
        };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.authVersion = (user as typeof user & { authVersion?: number }).authVersion;
        token.role = (user as typeof user & { role?: "admin" | "teacher" | "student" }).role;
        token.username = (user as typeof user & { username?: string }).username;
        token.contact = (user as typeof user & { contact?: string | null }).contact;
      }

      return token;
    },
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        authVersion: token.authVersion ?? 0,
        id: token.sub ?? "",
        role: token.role ?? "student",
        username: token.username ?? "",
        contact: token.contact ?? null,
      },
    }),
  },
} satisfies NextAuthConfig;
