import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { HandoverService } from "@/services/handover.service";

export const GET = apiHandler(async (_req, context) => {
  await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const handover = await HandoverService.getHandover(id);
  return successResponse(handover);
});
