import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { PayrollService } from "@/services/payroll.service";

/**
 * GET /api/payroll/[id]/payslip/[lineId]
 * Returns payslip data for PDF generation.
 */
export const GET = apiHandler(async (_req: Request, context: unknown) => {
  await getCurrentUser();
  const { id, lineId } = await (context as { params: Promise<{ id: string; lineId: string }> }).params;
  const result = await PayrollService.generatePayslip(id, lineId);
  return successResponse(result);
});
