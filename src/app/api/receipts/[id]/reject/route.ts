import { z } from "zod";
import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { ReceiptService } from "@/services/receipt.service";

const rejectSchema = z.object({ reason: z.string().min(1) });

export const POST = apiHandler(async (req: Request, context: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = rejectSchema.parse(await req.json());
  const receipt = await ReceiptService.rejectReceipt(id, body.reason, user.id, user.role, ip ?? undefined);
  return successResponse(receipt);
});
