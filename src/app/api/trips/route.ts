import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { TripService } from "@/services/trip.service";

export const GET = apiHandler(async (req) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);

  const result = await TripService.listTrips({
    ...pagination,
    status: searchParams.get("status") ?? undefined,
    driverId: searchParams.get("driverId") ?? undefined,
    date: searchParams.get("date") ?? undefined,
  });
  return successResponse(result);
});

export const POST = apiHandler(async (req) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();

  const trip = await TripService.createTrip(body, user.id, user.role, ip ?? undefined);
  return successResponse(trip, 201);
});
