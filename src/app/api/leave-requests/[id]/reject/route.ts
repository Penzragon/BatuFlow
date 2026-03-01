import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { LeaveService } from "@/services/leave.service";

export const POST = apiHandler(async (req: Request, context: unknown) => {
  const user = await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await req.json().catch(() => ({}));
  const reason = (body.reason as string) ?? "Rejected";
  const updated = await LeaveService.rejectLeave(id, reason, user.id);
  return successResponse(updated);
});
