import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { PayrollService, createPayrollRunSchema } from "@/services/payroll.service";

/**
 * GET /api/payroll
 * Paginated list with status filter.
 */
export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);
  const status = searchParams.get("status") ?? undefined;

  const result = await PayrollService.listPayrollRuns({ ...pagination, status });
  return successResponse(result);
});

/**
 * POST /api/payroll
 * Create payroll run for given month/year.
 */
export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const body = await req.json();
  const data = createPayrollRunSchema.parse(body);
  const run = await PayrollService.createPayrollRun(data, user.id);
  return successResponse(run, 201);
});
