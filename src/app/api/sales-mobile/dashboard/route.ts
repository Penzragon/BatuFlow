import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { SalesMobileDashboardService } from "@/services/sales-mobile-dashboard.service";

function httpError(message: string, status: number): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

export const GET = apiHandler(async () => {
  const user = await getCurrentUser();
  if (!["ADMIN", "MANAGER", "STAFF"].includes(user.role)) {
    throw httpError("errors.forbidden", 403);
  }

  const data = await SalesMobileDashboardService.getKpis(user.id, user.role);
  return successResponse(data);
});
