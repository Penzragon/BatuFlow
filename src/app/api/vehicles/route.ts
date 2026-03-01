import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { VehicleService } from "@/services/vehicle.service";

export const GET = apiHandler(async (req) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);

  const result = await VehicleService.listVehicles(pagination);
  return successResponse(result);
});

export const POST = apiHandler(async (req) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();

  const vehicle = await VehicleService.createVehicle(body, user.id, user.role, ip ?? undefined);
  return successResponse(vehicle, 201);
});
