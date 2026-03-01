import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { ExpenseCategoryService, createCategorySchema } from "@/services/expense-category.service";

/**
 * GET /api/expense-categories
 * Paginated list of expense categories.
 */
export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);

  const result = await ExpenseCategoryService.listCategories(pagination);
  return successResponse(result);
});

/**
 * POST /api/expense-categories
 * Creates a new expense category.
 */
export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();
  const data = createCategorySchema.parse(body);
  const category = await ExpenseCategoryService.createCategory(data, user.id, user.role, ip ?? undefined);
  return successResponse(category, 201);
});
