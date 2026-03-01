import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { FiscalPeriodService } from "@/services/fiscal-period.service";

/**
 * POST /api/fiscal-periods/:id/close
 * Closes a fiscal period (prevents further journal postings to that month).
 */
export const POST = apiHandler(async (req: Request, context: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const period = await FiscalPeriodService.closePeriod(id, user.id, user.role, ip ?? undefined);
  return successResponse(period);
});
