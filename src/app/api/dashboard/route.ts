import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { getDashboardData, getStaffDashboardData } from "@/services/dashboard.service";

/**
 * GET /api/dashboard
 * Returns dashboard data. For STAFF role returns staff dashboard (my sales, target, open SOs, pending commission, activity).
 * For Admin/Manager returns full dashboard with KPIs and widgets.
 */
export const GET = apiHandler(async (_req: Request) => {
  const user = await getCurrentUser();
  if (user.role === "STAFF") {
    const data = await getStaffDashboardData(user.id);
    return successResponse({ view: "staff", data });
  }
  const data = await getDashboardData();
  return successResponse({ view: "admin", data });
});
