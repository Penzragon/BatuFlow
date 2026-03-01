import { z } from "zod";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { apiHandler, successResponse, errorResponse } from "@/lib/api-utils";
import { WarehouseService } from "@/services/warehouse.service";

const createWarehouseSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

/**
 * GET /api/warehouses
 * Returns all active warehouses with location counts.
 */
export const GET = apiHandler(async () => {
  await getCurrentUser();
  const warehouses = await WarehouseService.listWarehouses();
  return successResponse(warehouses);
});

/**
 * POST /api/warehouses
 * Creates a new warehouse. Validates input with Zod schema.
 */
export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const body = await req.json();
  const parsed = createWarehouseSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse("Validation failed", 422);
  }

  const warehouse = await WarehouseService.createWarehouse(
    parsed.data,
    user.id,
    user.role,
    getClientIp(req) ?? undefined
  );

  return successResponse(warehouse, 201);
});
