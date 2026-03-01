import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { CommissionService } from "@/services/commission.service";

export const GET = apiHandler(async (req: Request, context?: unknown) => {
  await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const commission = await CommissionService.getCommission(id);
  return successResponse(commission);
});
