import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { UserRole } from "@prisma/client";
import { authConfig } from "./auth.config";

/**
 * Full NextAuth configuration with Prisma-backed credential verification.
 * This file imports Prisma and is server-only — NOT used by middleware.
 */
export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (
          !user ||
          !user.passwordHash ||
          !user.isActive ||
          user.deletedAt != null
        ) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: null,
          role: user.role as UserRole,
          locale: user.locale ?? "en",
        };
      },
    }),
  ],
});
