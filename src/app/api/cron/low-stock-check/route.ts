import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { checkLowStockAlerts } from "@/services/notification.service";

/**
 * GET /api/cron/low-stock-check
 * Runs low-stock alert check and creates notifications for eligible users.
 * Call periodically (e.g. daily cron) or when an Admin/Manager loads the dashboard (with throttle).
 * Requires authentication and ADMIN or MANAGER role.
 */
export const GET = apiHandler(async (_req: Request) => {
  const user = await getCurrentUser();
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return new Response(
      JSON.stringify({ success: false, error: "Forbidden" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
  const count = await checkLowStockAlerts();
  return successResponse({ notificationsCreated: count });
});
