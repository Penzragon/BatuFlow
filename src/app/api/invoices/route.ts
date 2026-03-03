import { apiHandler, successResponse, parsePaginationParams, errorResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { InvoiceService } from "@/services/invoice.service";

export const GET = apiHandler(async (req) => {
  const user = await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);

  const result = await InvoiceService.listInvoices({
    ...pagination,
    status: searchParams.get("status") as any ?? undefined,
    customerId: searchParams.get("customerId") ?? undefined,
    overdue: searchParams.get("overdue") === "true",
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    viewer: { id: user.id, role: user.role },
  });

  return successResponse(result);
});

export const POST = apiHandler(async (req) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();

  if (!body.doId) return errorResponse("Delivery Order ID is required");

  const invoice = await InvoiceService.createInvoice(body.doId, user.id, user.role, ip ?? undefined);
  return successResponse(invoice, 201);
});
