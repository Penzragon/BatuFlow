import { apiHandler, successResponse } from "@/lib/api-utils";
import { requirePermission } from "@/lib/auth-utils";
import { ProductService, uomConversionsSchema } from "@/services/product.service";

/**
 * PUT /api/products/:id/uom-conversions
 * Replaces all UOM conversions for a product with the provided set.
 * Requires inventory:update permission.
 */
export const PUT = apiHandler(async (req: Request, context: unknown) => {
  await requirePermission("inventory", "update");
  const { id } = (context as { params: Promise<{ id: string }> }).params
    ? await (context as { params: Promise<{ id: string }> }).params
    : (context as { params: { id: string } }).params;
  const body = await req.json();
  const { conversions } = uomConversionsSchema.parse(body);
  const result = await ProductService.setUomConversions(id, conversions);
  return successResponse(result);
});
