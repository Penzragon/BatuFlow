import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-utils";
import { apiHandler, successResponse, errorResponse } from "@/lib/api-utils";
import { WarehouseService } from "@/services/warehouse.service";

const createLocationSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  zone: z.string().optional(),
});

/**
 * GET /api/warehouses/[id]/locations
 * Lists all storage locations within a warehouse.
 */
export const GET = apiHandler(async (_req: Request, context: unknown) => {
  await getCurrentUser();
  const { id } = (context as { params: Promise<{ id: string }> }).params
    ? await (context as { params: Promise<{ id: string }> }).params
    : (context as { params: { id: string } }).params;
  const locations = await WarehouseService.listLocations(id);
  return successResponse(locations);
});

/**
 * POST /api/warehouses/[id]/locations
 * Creates a new storage location in the warehouse.
 */
export const POST = apiHandler(async (req: Request, context: unknown) => {
  await getCurrentUser();
  const { id } = (context as { params: Promise<{ id: string }> }).params
    ? await (context as { params: Promise<{ id: string }> }).params
    : (context as { params: { id: string } }).params;
  const body = await req.json();
  const parsed = createLocationSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse("Validation failed", 422);
  }

  const location = await WarehouseService.createLocation(id, parsed.data);
  return successResponse(location, 201);
});
