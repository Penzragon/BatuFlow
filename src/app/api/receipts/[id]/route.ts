import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { ReceiptService, updateReceiptSchema } from "@/services/receipt.service";

export const GET = apiHandler(async (_req: Request, context: unknown) => {
  await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const receipt = await ReceiptService.getReceipt(id);
  return successResponse(receipt);
});

export const PUT = apiHandler(async (req: Request, context: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await req.json();
  const data = updateReceiptSchema.parse(body);
  const receipt = await ReceiptService.updateReceipt(id, data, user.id, user.role, ip ?? undefined);
  return successResponse(receipt);
});
