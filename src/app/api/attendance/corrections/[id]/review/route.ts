import { apiHandler, successResponse } from "@/lib/api-utils";
import { requireRole } from "@/lib/auth-utils";
import { AttendanceService } from "@/services/attendance.service";

export const POST = apiHandler(async (req: Request, context?: unknown) => {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const params = context as { params: Promise<{ id: string }> };
  const { id } = await params.params;
  const body = await req.json();
  const action = body?.action as "APPROVED" | "REJECTED";
  if (action !== "APPROVED" && action !== "REJECTED") throw new Error("Invalid action");

  const result = await AttendanceService.reviewCorrection(id, user.id, action, body?.rejectionReason);
  return successResponse(result);
});
