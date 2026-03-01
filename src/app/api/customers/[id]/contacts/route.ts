import { z } from "zod";
import {
  apiHandler,
  successResponse,
  errorResponse,
} from "@/lib/api-utils";
import { requirePermission } from "@/lib/auth-utils";
import { CustomerService } from "@/services/customer.service";

const createContactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  position: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/customers/:id/contacts - Lists all contacts for a customer.
 */
export const GET = apiHandler(async (_req: Request, context: unknown) => {
  await requirePermission("sales", "view");
  const { id } = await (context as RouteContext).params;

  const customer = await CustomerService.getCustomer(id);
  return successResponse(customer.contacts);
});

/**
 * POST /api/customers/:id/contacts - Adds a contact person to a customer.
 */
export const POST = apiHandler(async (req: Request, context: unknown) => {
  await requirePermission("sales", "create");
  const { id } = await (context as RouteContext).params;

  const body = await req.json();
  const parsed = createContactSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(
      parsed.error.issues.map((i) => i.message).join(", "),
      422
    );
  }

  const contact = await CustomerService.addContact(id, parsed.data);
  return successResponse(contact, 201);
});
