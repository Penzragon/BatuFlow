import { apiHandler, successResponse } from "@/lib/api-utils";
import { requirePermission, getClientIp } from "@/lib/auth-utils";
import { ProductService, priceTiersSchema } from "@/services/product.service";

/**
 * PUT /api/products/:id/price-tiers
 * Replaces all price tiers for a product with the provided set.
 * Requires inventory:update permission.
 */
export const PUT = apiHandler(async (req: Request, context: unknown) => {
  const user = await requirePermission("inventory", "update");
  const ip = getClientIp(req);
  const { id } = (context as { params: Promise<{ id: string }> }).params
    ? await (context as { params: Promise<{ id: string }> }).params
    : (context as { params: { id: string } }).params;
  const body = await req.json();
  const { tiers } = priceTiersSchema.parse(body);
  const result = await ProductService.setPriceTiers(id, tiers, user.id, user.role, ip ?? undefined);
  return successResponse(result);
});
