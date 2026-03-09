import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { ReceiptService, createReceiptSchema } from "@/services/receipt.service";

export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);

  const result = await ReceiptService.listReceipts({
    ...pagination,
    status: searchParams.get("status") ?? undefined,
    categoryId: searchParams.get("categoryId") ?? undefined,
    submittedBy: searchParams.get("submittedBy") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
  });

  return successResponse(result);
});

export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();
  const data = createReceiptSchema.parse(body);
  const receipt = await ReceiptService.createReceipt(data, user.id, user.role, ip ?? undefined);
  return successResponse(receipt, 201);
});
