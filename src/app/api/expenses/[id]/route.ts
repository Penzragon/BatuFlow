import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { ExpenseService, updateExpenseSchema } from "@/services/expense.service";

export const GET = apiHandler(async (_req: Request, context: unknown) => {
  await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const expense = await ExpenseService.getExpense(id);
  return successResponse(expense);
});

export const PUT = apiHandler(async (req: Request, context: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await req.json();
  const data = updateExpenseSchema.parse(body);
  const expense = await ExpenseService.updateExpense(id, data, user.id, user.role, ip ?? undefined);
  return successResponse(expense);
});
