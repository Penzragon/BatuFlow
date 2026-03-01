import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { LeaveService, createLeaveRequestSchema } from "@/services/leave.service";

/**
 * GET /api/leave-requests
 * Paginated list with employeeId, status, dateFrom, dateTo filters.
 */
export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);
  const employeeId = searchParams.get("employeeId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;

  const result = await LeaveService.listLeaveRequests({
    ...pagination,
    employeeId,
    status,
    dateFrom,
    dateTo,
  });
  return successResponse(result);
});

/**
 * POST /api/leave-requests
 * Create a new leave request (PENDING).
 */
export const POST = apiHandler(async (req: Request) => {
  await getCurrentUser();
  const body = await req.json();
  const data = createLeaveRequestSchema.parse(body);
  const leave = await LeaveService.createLeaveRequest(data);
  return successResponse(leave, 201);
});
