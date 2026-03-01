import { apiHandler, successResponse } from "@/lib/api-utils";
import { requireRole, getClientIp } from "@/lib/auth-utils";
import { SalesOrderService } from "@/services/sales-order.service";

export const POST = apiHandler(async (req, context) => {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;

  const so = await SalesOrderService.approveSO(id, user.id, user.role, ip ?? undefined);
  return successResponse(so);
});
