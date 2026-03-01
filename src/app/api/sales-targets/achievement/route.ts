import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { SalesTargetService } from "@/services/sales-target.service";

export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const periodYear = searchParams.get("periodYear") ? parseInt(searchParams.get("periodYear")!, 10) : undefined;
  const periodMonth = searchParams.get("periodMonth") ? parseInt(searchParams.get("periodMonth")!, 10) : undefined;
  const result = await SalesTargetService.getAchievementSummary(periodYear, periodMonth);
  return successResponse(result);
});
