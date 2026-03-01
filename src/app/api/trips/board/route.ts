import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { TripService } from "@/services/trip.service";

export const GET = apiHandler(async () => {
  await getCurrentUser();
  const board = await TripService.getDeliveryBoard();
  return successResponse(board);
});
