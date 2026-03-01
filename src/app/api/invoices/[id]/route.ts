import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { InvoiceService } from "@/services/invoice.service";

export const GET = apiHandler(async (_req, context) => {
  await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const invoice = await InvoiceService.getInvoice(id);
  return successResponse(invoice);
});
