import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ImportPageClient } from "./import-page-client";

/**
 * Data Import page - admin only.
 * Redirects non-admin users to settings.
 */
export default async function ImportPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/settings");
  }

  return <ImportPageClient />;
}
