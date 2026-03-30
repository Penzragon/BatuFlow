import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, requireRole } from "@/lib/auth-utils";
import { AttendanceService, setScheduleSchema } from "@/services/attendance.service";

export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  if (!employeeId) throw new Error("employeeId is required");

  const schedule = await AttendanceService.getSchedule(employeeId);
  return successResponse(schedule);
});

export const PUT = apiHandler(async (req: Request) => {
  await requireRole(["ADMIN", "MANAGER"]);
  const body = await req.json();
  const payload = setScheduleSchema.parse(body);
  const schedule = await AttendanceService.setSchedule(payload);
  return successResponse(schedule);
});
