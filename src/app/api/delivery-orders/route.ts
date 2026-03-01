import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { DeliveryOrderService } from "@/services/delivery-order.service";

export const GET = apiHandler(async (req) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);

  const result = await DeliveryOrderService.listDOs({
    ...pagination,
    salesOrderId: searchParams.get("salesOrderId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });

  return successResponse(result);
});

export const POST = apiHandler(async (req) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();

  const deliveryOrder = await DeliveryOrderService.createDO(body, user.id, user.role, ip ?? undefined);
  return successResponse(deliveryOrder, 201);
});
