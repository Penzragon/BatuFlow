import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { DeliveryOrderService } from "@/services/delivery-order.service";

export const GET = apiHandler(async (_req, context) => {
  const user = await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const deliveryOrder = await DeliveryOrderService.getDO(id, { id: user.id, role: user.role });
  return successResponse(deliveryOrder);
});
