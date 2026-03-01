import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { ExpenseService, createExpenseSchema } from "@/services/expense.service";

/**
 * GET /api/expenses
 * Paginated list with status, categoryId, dateFrom, dateTo, and submittedBy filters.
 */
export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);
  const status = searchParams.get("status") ?? undefined;
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;
  const submittedBy = searchParams.get("submittedBy") ?? undefined;

  const result = await ExpenseService.listExpenses({
    ...pagination,
    status,
    categoryId,
    dateFrom,
    dateTo,
    submittedBy,
  });
  return successResponse(result);
});

/**
 * POST /api/expenses
 * Creates a new expense in DRAFT status.
 */
export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();
  const data = createExpenseSchema.parse(body);
  const expense = await ExpenseService.createExpense(data, user.id, user.role, ip ?? undefined);
  return successResponse(expense, 201);
});
