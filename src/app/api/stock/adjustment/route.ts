import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { StockService } from "@/services/stock.service";

export const POST = apiHandler(async (req) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();

  const entry = await StockService.manualAdjustment(body, user.id, user.role, ip ?? undefined);
  return successResponse(entry, 201);
});
