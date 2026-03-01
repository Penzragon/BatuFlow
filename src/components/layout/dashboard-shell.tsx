"use client";

import { useState, useEffect } from "react";
import type { Session } from "next-auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardShellProps {
  session: Session;
  children: React.ReactNode;
}

/**
 * Wraps the dashboard layout (sidebar + topbar + content) and only renders
 * the Radix-based UI after the component has mounted on the client. This
 * prevents hydration mismatches caused by Radix generating different
 * auto-IDs (aria-controls, etc.) on the server vs the client.
 */
export function DashboardShell({ session, children }: DashboardShellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-white px-4">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-4 flex-1 max-w-[200px]" />
        </header>
        <div className="flex flex-1 bg-gray-50 p-4 md:p-6">
          <Skeleton className="h-full w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <TopBar session={session} />
        <div className="flex-1 bg-gray-50 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
