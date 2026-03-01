import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { PickListService } from "@/services/pick-list.service";

export const POST = apiHandler(async (req, context) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await req.json();
  const assignedTo = body.assignedTo ?? user.id;

  const pl = await PickListService.startPicking(id, assignedTo, user.id, user.role, ip ?? undefined);
  return successResponse(pl);
});
