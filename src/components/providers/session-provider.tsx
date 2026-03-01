"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * Client-side wrapper that provides the NextAuth session to all
 * components using useSession(). Required for profile page and
 * any other client component that needs current user data.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
