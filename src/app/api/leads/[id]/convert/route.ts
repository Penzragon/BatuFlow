import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { LeadService } from "@/services/lead.service";

export const POST = apiHandler(async (req: Request, context?: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const result = await LeadService.convertToCustomer(id, user.id, user.role, ip ?? undefined);
  return successResponse(result);
});
