import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { VehicleService } from "@/services/vehicle.service";

export const GET = apiHandler(async (_req, context) => {
  await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const vehicle = await VehicleService.getVehicle(id);
  return successResponse(vehicle);
});

export const PUT = apiHandler(async (req, context) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await req.json();

  const vehicle = await VehicleService.updateVehicle(id, body, user.id, user.role, ip ?? undefined);
  return successResponse(vehicle);
});

export const DELETE = apiHandler(async (req, context) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;

  await VehicleService.deleteVehicle(id, user.id, user.role, ip ?? undefined);
  return successResponse({ message: "Vehicle deleted" });
});
