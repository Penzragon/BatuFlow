import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { ExpenseCategoryService, updateCategorySchema } from "@/services/expense-category.service";

export const PUT = apiHandler(async (req: Request, context: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await req.json();
  const data = updateCategorySchema.parse(body);
  const category = await ExpenseCategoryService.updateCategory(id, data, user.id, user.role, ip ?? undefined);
  return successResponse(category);
});

export const DELETE = apiHandler(async (req: Request, context: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  await ExpenseCategoryService.deleteCategory(id, user.id, user.role, ip ?? undefined);
  return successResponse({ deleted: true });
});
