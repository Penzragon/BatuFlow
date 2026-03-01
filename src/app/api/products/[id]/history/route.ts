import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { ProductService } from "@/services/product.service";

/**
 * GET /api/products/:id/history
 * Returns the capital cost change history for a product,
 * ordered newest-first. Requires authentication.
 */
export const GET = apiHandler(async (_req: Request, context: unknown) => {
  await getCurrentUser();
  const { id } = (context as { params: Promise<{ id: string }> }).params
    ? await (context as { params: Promise<{ id: string }> }).params
    : (context as { params: { id: string } }).params;
  const history = await ProductService.getCapitalHistory(id);
  return successResponse(history);
});
