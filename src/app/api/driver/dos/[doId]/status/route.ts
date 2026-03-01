import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { DriverService } from "@/services/driver.service";

export const PUT = apiHandler(async (req, context) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { doId } = await (context as { params: Promise<{ doId: string }> }).params;
  const body = await req.json();

  const updated = await DriverService.updateDeliveryStatus(
    doId,
    user.id,
    body,
    user.role,
    ip ?? undefined
  );
  return successResponse(updated);
});
