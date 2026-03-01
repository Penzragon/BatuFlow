import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { FinancialReportService } from "@/services/financial-report.service";

/**
 * GET /api/reports/trial-balance
 * Returns trial balance for a given period (dateFrom/dateTo or year/month).
 */
export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;
  const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;
  const month = searchParams.get("month") ? Number(searchParams.get("month")) : undefined;

  const result = await FinancialReportService.getTrialBalance({ dateFrom, dateTo, year, month });
  return successResponse(result);
});
