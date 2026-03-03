import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { InvoiceService } from "@/services/invoice.service";

export const GET = apiHandler(async () => {
  const user = await getCurrentUser();
  const aging = await InvoiceService.getAgingReport({ id: user.id, role: user.role });
  return successResponse(aging);
});
