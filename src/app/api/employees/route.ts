import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { EmployeeService, createEmployeeSchema } from "@/services/employee.service";

/**
 * GET /api/employees
 * Paginated list with search, status, department filters.
 */
export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);
  const status = searchParams.get("status") ?? undefined;
  const department = searchParams.get("department") ?? undefined;

  const result = await EmployeeService.listEmployees({
    ...pagination,
    status,
    department,
  });
  return successResponse(result);
});

/**
 * POST /api/employees
 * Create a new employee.
 */
export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();
  const data = createEmployeeSchema.parse(body);
  const employee = await EmployeeService.createEmployee(data, user.id, user.role, ip ?? undefined);
  return successResponse(employee, 201);
});
