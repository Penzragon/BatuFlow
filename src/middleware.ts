import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

/**
 * Next.js middleware for route protection.
 * Uses the edge-compatible auth config (no Prisma/pg imports).
 * The authorized callback in authConfig handles redirect logic.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/((?!login|api/auth|_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
