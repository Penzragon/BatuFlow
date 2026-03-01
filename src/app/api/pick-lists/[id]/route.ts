import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { PickListService } from "@/services/pick-list.service";

export const GET = apiHandler(async (_req, context) => {
  await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const pl = await PickListService.getPickList(id);
  return successResponse(pl);
});
