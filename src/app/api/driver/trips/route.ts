import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { DriverService } from "@/services/driver.service";

export const GET = apiHandler(async (req) => {
  const user = await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const history = searchParams.get("history") === "true";

  if (history) {
    const trips = await DriverService.getMyDeliveryHistory(user.id);
    return successResponse(trips);
  }

  const trips = await DriverService.getMyTrips(user.id);
  return successResponse(trips);
});
