import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { ExpenseService } from "@/services/expense.service";

/**
 * POST /api/expenses/:id/reject
 * Rejects a SUBMITTED expense. Body must include { reason: string }.
 */
export const POST = apiHandler(async (req: Request, context: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await req.json();
  const expense = await ExpenseService.rejectExpense(id, body.reason, user.id, user.role, ip ?? undefined);
  return successResponse(expense);
});
