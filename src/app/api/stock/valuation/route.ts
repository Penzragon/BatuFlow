import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { StockService } from "@/services/stock.service";

export const GET = apiHandler(async (req) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get("warehouseId") ?? undefined;

  const result = await StockService.getStockValuation(warehouseId);
  return successResponse(result);
});
