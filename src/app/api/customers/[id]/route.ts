import { z } from "zod";
import {
  apiHandler,
  successResponse,
  errorResponse,
} from "@/lib/api-utils";
import { requirePermission, getClientIp } from "@/lib/auth-utils";
import { CustomerService } from "@/services/customer.service";

const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  taxId: z.string().optional(),
  paymentTermsDays: z.number().int().min(0).optional(),
  salespersonId: z.string().optional(),
  region: z.string().optional(),
  tier: z.string().optional(),
  gpsLatitude: z.number().optional().nullable(),
  gpsLongitude: z.number().optional().nullable(),
  isActive: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/customers/:id - Returns a single customer with contacts.
 */
export const GET = apiHandler(async (_req: Request, context: unknown) => {
  await requirePermission("sales", "view");
  const { id } = await (context as RouteContext).params;

  const customer = await CustomerService.getCustomer(id);
  return successResponse(customer);
});

/**
 * PUT /api/customers/:id - Updates an existing customer.
 * Validates input with Zod and logs changes in audit trail.
 */
export const PUT = apiHandler(async (req: Request, context: unknown) => {
  const user = await requirePermission("sales", "update");
  const ip = getClientIp(req);
  const { id } = await (context as RouteContext).params;

  const body = await req.json();
  const parsed = updateCustomerSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(
      parsed.error.issues.map((i) => i.message).join(", "),
      422
    );
  }

  const { gpsLatitude, gpsLongitude, ...rest } = parsed.data;
  const data = {
    ...rest,
    ...(gpsLatitude != null && { gpsLatitude }),
    ...(gpsLongitude != null && { gpsLongitude }),
  };

  const customer = await CustomerService.updateCustomer(
    id,
    data,
    user.id,
    user.role,
    ip ?? undefined
  );

  return successResponse(customer);
});

/**
 * DELETE /api/customers/:id - Soft-deletes a customer.
 */
export const DELETE = apiHandler(async (req: Request, context: unknown) => {
  const user = await requirePermission("sales", "delete");
  const ip = getClientIp(req);
  const { id } = await (context as RouteContext).params;

  await CustomerService.deleteCustomer(
    id,
    user.id,
    user.role,
    ip ?? undefined
  );

  return successResponse({ deleted: true });
});
