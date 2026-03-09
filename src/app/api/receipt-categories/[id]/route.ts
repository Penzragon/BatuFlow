import { apiHandler, successResponse } from "@/lib/api-utils";
import { getClientIp, getCurrentUser } from "@/lib/auth-utils";
import {
  ReceiptCategoryService,
  updateReceiptCategorySchema,
} from "@/services/receipt-category.service";

export const PUT = apiHandler(async (req: Request, context: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await req.json();
  const data = updateReceiptCategorySchema.parse(body);
  const category = await ReceiptCategoryService.updateCategory(id, data, user.id, user.role, ip ?? undefined);
  return successResponse(category);
});

export const DELETE = apiHandler(async (req: Request, context: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  await ReceiptCategoryService.deleteCategory(id, user.id, user.role, ip ?? undefined);
  return successResponse({ deleted: true });
});
