import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { AttendanceService } from "@/services/attendance.service";

export const GET = apiHandler(async () => {
  const user = await getCurrentUser();
  const data = await AttendanceService.getTodayStatusByUser(user.id);
  return successResponse(data);
});
