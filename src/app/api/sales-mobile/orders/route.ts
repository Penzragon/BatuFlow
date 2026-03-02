import { z } from "zod";
import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { SalesOrderService, createSOSchema } from "@/services/sales-order.service";

function httpError(message: string, status: number): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

export const POST = apiHandler(async (req) => {
  const user = await getCurrentUser();
  if (!["ADMIN", "MANAGER", "STAFF"].includes(user.role)) {
    throw httpError("errors.forbidden", 403);
  }

  const body = await req.json();
  const parsed = createSOSchema.safeParse(body);
  if (!parsed.success) {
    throw httpError("errors.validation_failed", 400);
  }

  const ip = getClientIp(req);

  try {
    const so = await SalesOrderService.createSO(parsed.data, user.id, user.role, ip ?? undefined);
    return successResponse(so, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw httpError("errors.validation_failed", 400);
    }
    throw error;
  }
});
