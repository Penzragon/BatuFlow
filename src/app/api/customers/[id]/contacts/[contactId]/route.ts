import { z } from "zod";
import {
  apiHandler,
  successResponse,
  errorResponse,
} from "@/lib/api-utils";
import { requirePermission } from "@/lib/auth-utils";
import { CustomerService } from "@/services/customer.service";

const updateContactSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  position: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

type RouteContext = {
  params: Promise<{ id: string; contactId: string }>;
};

/**
 * PUT /api/customers/:id/contacts/:contactId - Updates a contact person.
 */
export const PUT = apiHandler(async (req: Request, context: unknown) => {
  await requirePermission("sales", "update");
  const { contactId } = await (context as RouteContext).params;

  const body = await req.json();
  const parsed = updateContactSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(
      parsed.error.issues.map((i) => i.message).join(", "),
      422
    );
  }

  const contact = await CustomerService.updateContact(
    contactId,
    parsed.data as {
      name: string;
      phone?: string;
      email?: string;
      position?: string;
      isPrimary?: boolean;
    }
  );

  return successResponse(contact);
});

/**
 * DELETE /api/customers/:id/contacts/:contactId - Removes a contact person.
 */
export const DELETE = apiHandler(async (_req: Request, context: unknown) => {
  await requirePermission("sales", "delete");
  const { contactId } = await (context as RouteContext).params;

  await CustomerService.removeContact(contactId);
  return successResponse({ deleted: true });
});
