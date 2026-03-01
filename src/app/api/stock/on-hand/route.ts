import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { StockService } from "@/services/stock.service";

export const GET = apiHandler(async (req) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);
  const warehouseId = searchParams.get("warehouseId") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const lowStockOnly = searchParams.get("lowStockOnly") === "true";

  const result = await StockService.getStockOnHand({ ...pagination, warehouseId, category, lowStockOnly });
  return successResponse(result);
});
