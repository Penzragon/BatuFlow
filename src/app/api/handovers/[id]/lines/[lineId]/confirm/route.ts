import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { HandoverService } from "@/services/handover.service";

export const POST = apiHandler(async (req, context) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const params = await (context as { params: Promise<{ id: string; lineId: string }> }).params;

  const line = await HandoverService.confirmHandoverLine(
    params.id, params.lineId,
    user.id, user.role, ip ?? undefined
  );
  return successResponse(line);
});
