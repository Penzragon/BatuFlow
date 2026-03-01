import { z } from "zod";
import {
  apiHandler,
  successResponse,
  errorResponse,
  parsePaginationParams,
} from "@/lib/api-utils";
import { getCurrentUser, requirePermission, getClientIp } from "@/lib/auth-utils";
import { CustomerService } from "@/services/customer.service";

const createCustomerSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  taxId: z.string().optional(),
  paymentTermsDays: z.number().int().min(0).default(30),
  salespersonId: z.string().optional(),
  region: z.string().optional(),
  tier: z.string().optional(),
  gpsLatitude: z.number().optional(),
  gpsLongitude: z.number().optional(),
  isActive: z.boolean().default(true),
});

/**
 * GET /api/customers - Returns a paginated list of customers.
 * Supports search, region, tier, and active status filters.
 */
export const GET = apiHandler(async (req: Request) => {
  await requirePermission("sales", "view");

  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);

  const region = searchParams.get("region") ?? undefined;
  const tier = searchParams.get("tier") ?? undefined;
  const isActiveParam = searchParams.get("isActive");
  const isActive =
    isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;

  const result = await CustomerService.listCustomers({
    ...pagination,
    region,
    tier,
    isActive,
  });

  return successResponse(result);
});

/**
 * POST /api/customers - Creates a new customer record.
 * Validates input with Zod and logs creation in audit trail.
 */
export const POST = apiHandler(async (req: Request) => {
  const user = await requirePermission("sales", "create");
  const ip = getClientIp(req);

  const body = await req.json();
  const parsed = createCustomerSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(
      parsed.error.issues.map((i) => i.message).join(", "),
      422
    );
  }

  const customer = await CustomerService.createCustomer(
    parsed.data,
    user.id,
    user.role,
    ip ?? undefined
  );

  return successResponse(customer, 201);
});
