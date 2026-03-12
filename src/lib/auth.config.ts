import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

/**
 * Auth configuration shared between the full NextAuth setup and the middleware.
 * This file intentionally does NOT import Prisma or any Node.js-only modules
 * so it can be used in the Edge Runtime middleware.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Actual authorize logic is in auth.ts (server-only)
      async authorize() {
        return null;
      },
    }),
  ],
  callbacks: {
    async authorized({ auth: session, request }) {
      if (!session?.user) return false;

      const pathname = request.nextUrl.pathname;
      const role = (session.user as { role?: string }).role;
      const shouldGate = role === "STAFF" || role === "MANAGER" || role === "ADMIN";

      if (!shouldGate) return true;

      const bypassPrefixes = [
        "/attendance/check-in",
        "/api/attendance/clock-in",
        "/api/attendance/clock-out",
        "/api/attendance/gate-status",
        "/api/auth",
        "/login",
        "/_next",
      ];
      const isBypassed =
        bypassPrefixes.some((prefix) => pathname.startsWith(prefix)) ||
        pathname === "/favicon.ico" ||
        /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$/i.test(pathname);

      if (isBypassed) return true;

      try {
        const gateUrl = new URL("/api/attendance/gate-status", request.nextUrl.origin);
        const res = await fetch(gateUrl.toString(), {
          headers: { cookie: request.headers.get("cookie") ?? "" },
        });
        const json = await res.json();
        const checkedIn = Boolean(json?.success && json?.data?.checkedIn);
        if (!checkedIn) {
          return Response.redirect(new URL("/attendance/check-in", request.nextUrl));
        }
        return true;
      } catch {
        return Response.redirect(new URL("/attendance/check-in", request.nextUrl));
      }
    },
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.locale = (user as any).locale;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
        (session.user as any).locale = (token.locale as string) ?? "en";
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
};
