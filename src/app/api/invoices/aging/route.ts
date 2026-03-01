import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { InvoiceService } from "@/services/invoice.service";

export const GET = apiHandler(async () => {
  await getCurrentUser();
  const aging = await InvoiceService.getAgingReport();
  return successResponse(aging);
});
