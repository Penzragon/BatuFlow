import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { DriverService } from "@/services/driver.service";

export const GET = apiHandler(async () => {
  const user = await getCurrentUser();
  const stats = await DriverService.getDashboardStats(user.id);
  return successResponse(stats);
});
