import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { LeaveService } from "@/services/leave.service";

export const GET = apiHandler(async (_req: Request, context: unknown) => {
  await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const leave = await LeaveService.getLeaveRequest(id);
  return successResponse(leave);
});
