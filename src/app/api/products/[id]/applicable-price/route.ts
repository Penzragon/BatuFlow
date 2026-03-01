import { apiHandler, successResponse, errorResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { SalesOrderService } from "@/services/sales-order.service";

/**
 * GET /api/products/[id]/applicable-price?qty=10
 * Returns the unit price and tier label for a product at the given quantity
 * (from price tiers or default sell price). Used by the sales order form
 * to display the correct price when product or qty changes.
 */
export const GET = apiHandler(async (_req, context) => {
  await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const url = new URL(_req.url);
  const qtyParam = url.searchParams.get("qty");
  const qty = qtyParam ? parseFloat(qtyParam) : 1;
  if (!Number.isFinite(qty) || qty < 0) {
    return errorResponse("Invalid qty parameter");
  }
  const result = await SalesOrderService.getApplicablePrice(id, qty);
  return successResponse(result);
});
