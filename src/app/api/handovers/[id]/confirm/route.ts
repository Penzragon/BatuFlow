import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { HandoverService } from "@/services/handover.service";

export const POST = apiHandler(async (req, context) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;

  const handover = await HandoverService.completeHandover(id, user.id, user.role, ip ?? undefined);
  return successResponse(handover);
});
