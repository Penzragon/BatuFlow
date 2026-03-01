import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { AttendanceService, recordAttendanceSchema } from "@/services/attendance.service";

/**
 * GET /api/attendance
 * Paginated list with employeeId, dateFrom, dateTo filters.
 */
export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);
  const employeeId = searchParams.get("employeeId") ?? undefined;
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;

  const result = await AttendanceService.listAttendance({
    ...pagination,
    employeeId,
    dateFrom,
    dateTo,
  });
  return successResponse(result);
});

/**
 * POST /api/attendance
 * Manual attendance entry (record).
 */
export const POST = apiHandler(async (req: Request) => {
  await getCurrentUser();
  const body = await req.json();
  const data = recordAttendanceSchema.parse(body);
  const attendance = await AttendanceService.recordAttendance(data);
  return successResponse(attendance, 201);
});
