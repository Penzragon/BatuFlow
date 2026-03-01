import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { SalesOrderService } from "@/services/sales-order.service";

export const GET = apiHandler(async (req) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);

  const result = await SalesOrderService.listSOs({
    ...pagination,
    status: searchParams.get("status") as any ?? undefined,
    customerId: searchParams.get("customerId") ?? undefined,
    createdBy: searchParams.get("createdBy") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
  });

  return successResponse(result);
});

export const POST = apiHandler(async (req) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();

  const so = await SalesOrderService.createSO(body, user.id, user.role, ip ?? undefined);
  return successResponse(so, 201);
});
