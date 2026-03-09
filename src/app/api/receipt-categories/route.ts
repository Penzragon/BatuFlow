import { apiHandler, parsePaginationParams, successResponse } from "@/lib/api-utils";
import { getClientIp, getCurrentUser } from "@/lib/auth-utils";
import {
  ReceiptCategoryService,
  createReceiptCategorySchema,
} from "@/services/receipt-category.service";

export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);

  const result = await ReceiptCategoryService.listCategories(pagination);
  return successResponse(result);
});

export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();
  const data = createReceiptCategorySchema.parse(body);
  const category = await ReceiptCategoryService.createCategory(data, user.id, user.role, ip ?? undefined);
  return successResponse(category, 201);
});
