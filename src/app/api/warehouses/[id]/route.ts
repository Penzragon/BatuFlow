import { z } from "zod";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { apiHandler, successResponse, errorResponse } from "@/lib/api-utils";
import { WarehouseService } from "@/services/warehouse.service";

const updateWarehouseSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/warehouses/[id]
 * Returns a single warehouse with its locations.
 */
export const GET = apiHandler(async (_req: Request, context: unknown) => {
  await getCurrentUser();
  const { id } = (context as { params: Promise<{ id: string }> }).params
    ? await (context as { params: Promise<{ id: string }> }).params
    : (context as { params: { id: string } }).params;
  const warehouse = await WarehouseService.getWarehouse(id);
  return successResponse(warehouse);
});

/**
 * PUT /api/warehouses/[id]
 * Updates warehouse fields. Validates input with Zod schema.
 */
export const PUT = apiHandler(async (req: Request, context: unknown) => {
  const user = await getCurrentUser();
  const { id } = (context as { params: Promise<{ id: string }> }).params
    ? await (context as { params: Promise<{ id: string }> }).params
    : (context as { params: { id: string } }).params;
  const body = await req.json();
  const parsed = updateWarehouseSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse("Validation failed", 422);
  }

  const warehouse = await WarehouseService.updateWarehouse(
    id,
    parsed.data,
    user.id,
    user.role,
    getClientIp(req) ?? undefined
  );

  return successResponse(warehouse);
});

/**
 * DELETE /api/warehouses/[id]
 * Soft-deletes a warehouse. Blocks deletion of the default warehouse.
 */
export const DELETE = apiHandler(async (req: Request, context: unknown) => {
  const user = await getCurrentUser();
  const { id } = (context as { params: Promise<{ id: string }> }).params
    ? await (context as { params: Promise<{ id: string }> }).params
    : (context as { params: { id: string } }).params;

  await WarehouseService.deleteWarehouse(
    id,
    user.id,
    user.role,
    getClientIp(req) ?? undefined
  );

  return successResponse({ deleted: true });
});
