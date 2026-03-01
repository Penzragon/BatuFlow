import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { ExpenseService } from "@/services/expense.service";

/**
 * GET /api/expenses/report
 * Generates an expense report grouped by category and user,
 * filtered by dateFrom, dateTo, categoryId, and submittedBy.
 */
export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const submittedBy = searchParams.get("submittedBy") ?? undefined;

  const report = await ExpenseService.getExpenseReport({ dateFrom, dateTo, categoryId, submittedBy });
  return successResponse(report);
});
