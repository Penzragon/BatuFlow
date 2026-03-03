import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { SalesOrderService } from "@/services/sales-order.service";

export const GET = apiHandler(async (_req, context) => {
  const user = await getCurrentUser();
  const { id } = (context as { params: Promise<{ id: string }> }).params
    ? await (context as { params: Promise<{ id: string }> }).params
    : { id: "" };
  const so = await SalesOrderService.getSO(id, { id: user.id, role: user.role });
  return successResponse(so);
});

export const PUT = apiHandler(async (req, context) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = (context as { params: Promise<{ id: string }> }).params
    ? await (context as { params: Promise<{ id: string }> }).params
    : { id: "" };
  const body = await req.json();

  const so = await SalesOrderService.updateSO(id, body, user.id, user.role, ip ?? undefined);
  return successResponse(so);
});
