import { apiHandler, successResponse, errorResponse } from "@/lib/api-utils";
import { requireRole, getClientIp } from "@/lib/auth-utils";
import { SalesOrderService } from "@/services/sales-order.service";

export const POST = apiHandler(async (req, context) => {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await req.json();

  if (!body.reason) return errorResponse("Rejection reason is required");

  const so = await SalesOrderService.rejectSO(id, user.id, body.reason, user.role, ip ?? undefined);
  return successResponse(so);
});
