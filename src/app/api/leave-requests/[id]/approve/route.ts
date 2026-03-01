import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { LeaveService } from "@/services/leave.service";

export const POST = apiHandler(async (_req: Request, context: unknown) => {
  const user = await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const updated = await LeaveService.approveLeave(id, user.id);
  return successResponse(updated);
});
