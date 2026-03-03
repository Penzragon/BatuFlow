import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { PaymentService } from "@/services/payment.service";

export const GET = apiHandler(async (_req, context) => {
  const user = await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const payments = await PaymentService.listPaymentsForInvoice(id, { id: user.id, role: user.role });
  return successResponse(payments);
});
