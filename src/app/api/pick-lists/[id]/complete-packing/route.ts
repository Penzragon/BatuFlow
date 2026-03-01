import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { PickListService } from "@/services/pick-list.service";

export const POST = apiHandler(async (req, context) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;

  const pl = await PickListService.completePacking(id, user.id, user.role, ip ?? undefined);
  return successResponse(pl);
});
