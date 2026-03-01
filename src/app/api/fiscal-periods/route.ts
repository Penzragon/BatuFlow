import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { FiscalPeriodService } from "@/services/fiscal-period.service";

/**
 * GET /api/fiscal-periods
 * Returns all fiscal periods ordered by year/month descending.
 */
export const GET = apiHandler(async () => {
  await getCurrentUser();
  const periods = await FiscalPeriodService.listPeriods();
  return successResponse(periods);
});

/**
 * POST /api/fiscal-periods
 * Ensures all 12 monthly periods exist for the given year.
 * Body: { year: number }
 */
export const POST = apiHandler(async (req: Request) => {
  await getCurrentUser();
  const body = await req.json();
  const periods = await FiscalPeriodService.ensurePeriodsExist(body.year);
  return successResponse(periods, 201);
});
