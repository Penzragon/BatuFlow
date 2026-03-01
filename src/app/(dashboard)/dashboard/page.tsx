import { auth } from "@/lib/auth";
import { DashboardClient } from "./dashboard-client";

/**
 * Dashboard page - server component that gets session and renders client.
 * The DashboardClient fetches dashboard data on mount from /api/dashboard.
 * STAFF users see a role-specific dashboard (my sales, target, open SOs, commissions, activity).
 */
export default async function DashboardPage() {
  const session = await auth();
  const role = session?.user?.role as string | undefined;

  return (
    <DashboardClient
      userName={session?.user?.name ?? undefined}
      userRole={role}
    />
  );
}
