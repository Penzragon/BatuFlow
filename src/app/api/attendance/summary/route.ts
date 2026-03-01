import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { AttendanceService } from "@/services/attendance.service";

/**
 * GET /api/attendance/summary?month=1&year=2025&employeeId=optional
 */
export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const employeeId = searchParams.get("employeeId") ?? undefined;

  const result = await AttendanceService.getMonthlyAttendanceSummary(month, year, employeeId);
  return successResponse(result);
});
