import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { StockService } from "@/services/stock.service";

export const GET = apiHandler(async (req) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);
  const productId = searchParams.get("productId") ?? undefined;
  const warehouseId = searchParams.get("warehouseId") ?? undefined;
  const movementType = searchParams.get("movementType") ?? undefined;
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;

  const result = await StockService.getStockMovements({
    ...pagination, productId, warehouseId, movementType, dateFrom, dateTo,
  });
  return successResponse(result);
});
