import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { VisitService } from "@/services/visit.service";

export const GET = apiHandler(async (_req, context) => {
  const user = await getCurrentUser();
  const { id } = (context as { params: Promise<{ id: string }> }).params
    ? await (context as { params: Promise<{ id: string }> }).params
    : { id: "" };

  const visit = await VisitService.getVisitById(id, { id: user.id, role: user.role });
  return successResponse(visit);
});
