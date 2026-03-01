import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { PayrollService } from "@/services/payroll.service";

export const POST = apiHandler(async (_req: Request, context: unknown) => {
  await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const run = await PayrollService.confirmPayrollRun(id);
  return successResponse(run);
});
