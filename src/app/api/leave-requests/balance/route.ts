import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { LeaveService } from "@/services/leave.service";

/**
 * GET /api/leave-requests/balance?employeeId=...&year=...
 */
export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);

  if (!employeeId) throw Object.assign(new Error("employeeId is required"), { status: 400 });

  const result = await LeaveService.getLeaveBalance(employeeId, year);
  return successResponse(result);
});
