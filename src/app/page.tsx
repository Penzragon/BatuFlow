import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Root page: redirects authenticated users by role.
 * Driver -> driver app, Warehouse -> warehouse app, others -> main dashboard.
 */
export default async function RootPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const role = (session.user as { role?: string }).role;
  if (role === "DRIVER") redirect("/driver/dashboard");
  if (role === "WAREHOUSE_STAFF") redirect("/warehouse/dashboard");
  redirect("/dashboard");
}
