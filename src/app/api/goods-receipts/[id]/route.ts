import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { GoodsReceiptService } from "@/services/goods-receipt.service";

export const GET = apiHandler(async (_req, context) => {
  await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const receipt = await GoodsReceiptService.getReceipt(id);
  return successResponse(receipt);
});
