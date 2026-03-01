import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-utils";
import { apiHandler, successResponse, errorResponse } from "@/lib/api-utils";
import { WarehouseService } from "@/services/warehouse.service";

const updateLocationSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  zone: z.string().optional(),
});

type RouteParams = { id: string; locationId: string };

/**
 * PUT /api/warehouses/[id]/locations/[locationId]
 * Updates a storage location's name, description, or zone.
 */
export const PUT = apiHandler(async (req: Request, context: unknown) => {
  await getCurrentUser();
  const { locationId } = (context as { params: Promise<RouteParams> }).params
    ? await (context as { params: Promise<RouteParams> }).params
    : (context as { params: RouteParams }).params;
  const body = await req.json();
  const parsed = updateLocationSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse("Validation failed", 422);
  }

  const location = await WarehouseService.updateLocation(locationId, parsed.data);
  return successResponse(location);
});

/**
 * DELETE /api/warehouses/[id]/locations/[locationId]
 * Permanently removes a storage location.
 */
export const DELETE = apiHandler(async (_req: Request, context: unknown) => {
  await getCurrentUser();
  const { locationId } = (context as { params: Promise<RouteParams> }).params
    ? await (context as { params: Promise<RouteParams> }).params
    : (context as { params: RouteParams }).params;

  await WarehouseService.deleteLocation(locationId);
  return successResponse({ deleted: true });
});
