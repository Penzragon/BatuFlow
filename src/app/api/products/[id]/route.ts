import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, requirePermission, getClientIp } from "@/lib/auth-utils";
import { ProductService, updateProductSchema } from "@/services/product.service";

/**
 * GET /api/products/:id
 * Returns a single product with its price tiers, UOM conversions,
 * and capital cost history. Requires authentication.
 */
export const GET = apiHandler(async (_req: Request, context: unknown) => {
  await getCurrentUser();
  const { id } = (context as { params: Promise<{ id: string }> }).params
    ? await (context as { params: Promise<{ id: string }> }).params
    : (context as { params: { id: string } }).params;
  const product = await ProductService.getProduct(id);
  return successResponse(product);
});

/**
 * PUT /api/products/:id
 * Updates a product. Requires inventory:update permission.
 * Automatically tracks capital cost changes when applicable.
 */
export const PUT = apiHandler(async (req: Request, context: unknown) => {
  const user = await requirePermission("inventory", "update");
  const ip = getClientIp(req);
  const { id } = (context as { params: Promise<{ id: string }> }).params
    ? await (context as { params: Promise<{ id: string }> }).params
    : (context as { params: { id: string } }).params;
  const body = await req.json();
  const data = updateProductSchema.parse(body);
  const product = await ProductService.updateProduct(id, data, user.id, user.role, ip ?? undefined);
  return successResponse(product);
});

/**
 * DELETE /api/products/:id
 * Soft-deletes a product. Requires inventory:delete permission.
 */
export const DELETE = apiHandler(async (req: Request, context: unknown) => {
  const user = await requirePermission("inventory", "delete");
  const ip = getClientIp(req);
  const { id } = (context as { params: Promise<{ id: string }> }).params
    ? await (context as { params: Promise<{ id: string }> }).params
    : (context as { params: { id: string } }).params;
  await ProductService.deleteProduct(id, user.id, user.role, ip ?? undefined);
  return successResponse({ deleted: true });
});
