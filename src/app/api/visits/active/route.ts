import { apiHandler, successResponse, errorResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { VisitService } from "@/services/visit.service";

export const GET = apiHandler(async (req) => {
  const user = await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId");

  if (!customerId) return errorResponse("customerId is required");

  const visit = await VisitService.getActiveVisit(customerId, user.id);
  return successResponse(visit);
});
