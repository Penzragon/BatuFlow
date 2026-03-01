import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { HandoverService } from "@/services/handover.service";

export const GET = apiHandler(async (req) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);
  const status = searchParams.get("status") ?? undefined;

  const result = await HandoverService.listHandovers({ ...pagination, status });
  return successResponse(result);
});

export const POST = apiHandler(async (req) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();

  const handover = await HandoverService.createHandover(
    body.tripId, body.warehouseStaffId ?? user.id,
    user.id, user.role, ip ?? undefined
  );
  return successResponse(handover, 201);
});
