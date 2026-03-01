import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { JournalService } from "@/services/journal.service";

/**
 * GET /api/reports/gl-detail
 * Returns general ledger detail lines for a specific account with pagination.
 */
export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const { page, pageSize } = parsePaginationParams(searchParams);
  const accountId = searchParams.get("accountId") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;

  const result = await JournalService.getGLDetail({ accountId, dateFrom, dateTo, page, pageSize });
  return successResponse(result);
});
