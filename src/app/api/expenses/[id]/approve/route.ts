import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { ExpenseService } from "@/services/expense.service";

/**
 * POST /api/expenses/:id/approve
 * Approves a SUBMITTED expense and auto-posts a journal entry.
 */
export const POST = apiHandler(async (req: Request, context: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const expense = await ExpenseService.approveExpense(id, user.id, user.role, ip ?? undefined);
  return successResponse(expense);
});
