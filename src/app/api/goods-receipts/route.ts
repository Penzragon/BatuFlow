import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { GoodsReceiptService } from "@/services/goods-receipt.service";

export const GET = apiHandler(async (req) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);
  const status = searchParams.get("status") ?? undefined;
  const warehouseId = searchParams.get("warehouseId") ?? undefined;

  const result = await GoodsReceiptService.listReceipts({ ...pagination, status, warehouseId });
  return successResponse(result);
});

export const POST = apiHandler(async (req) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();

  const receipt = await GoodsReceiptService.createReceipt(body, user.id, user.role, ip ?? undefined);
  return successResponse(receipt, 201);
});
