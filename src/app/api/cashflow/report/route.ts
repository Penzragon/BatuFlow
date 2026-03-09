import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { CashflowService } from "@/services/cashflow.service";

export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;
  const expenseCategoryId = searchParams.get("expenseCategoryId") ?? undefined;
  const receiptCategoryId = searchParams.get("receiptCategoryId") ?? undefined;
  const submittedBy = searchParams.get("submittedBy") ?? undefined;

  const report = await CashflowService.getCashflowReport({
    dateFrom,
    dateTo,
    expenseCategoryId,
    receiptCategoryId,
    submittedBy,
  });

  return successResponse(report);
});
