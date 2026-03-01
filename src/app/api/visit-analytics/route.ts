import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { VisitAnalyticsService } from "@/services/visit-analytics.service";

export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "frequency"; // frequency | summary | series
  const customerId = searchParams.get("customerId") ?? undefined;
  const salespersonId = searchParams.get("salespersonId") ?? undefined;
  const dateFrom = searchParams.get("dateFrom") ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const dateTo = searchParams.get("dateTo") ?? new Date().toISOString().slice(0, 10);
  const groupBy = (searchParams.get("groupBy") ?? "day") as "day" | "week" | "month";
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;

  if (type === "frequency") {
    const data = await VisitAnalyticsService.getVisitFrequencyByCustomer({
      customerId,
      salespersonId,
      limit,
    });
    return successResponse(data);
  }

  if (type === "summary") {
    const data = await VisitAnalyticsService.getVisitSummaryBySalesperson(dateFrom, dateTo);
    return successResponse(data);
  }

  if (type === "series") {
    const data = await VisitAnalyticsService.getVisitSeriesBySalesperson(dateFrom, dateTo, groupBy);
    return successResponse(data);
  }

  throw new Error("Invalid type: use frequency, summary, or series");
});
