import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { PickListService } from "@/services/pick-list.service";

export const PUT = apiHandler(async (req, context) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const params = await (context as { params: Promise<{ id: string; lineId: string }> }).params;
  const body = await req.json();

  const line = await PickListService.updatePickLine(
    params.id, params.lineId, body.qtyPicked, body.notes,
    user.id, user.role, ip ?? undefined
  );
  return successResponse(line);
});
