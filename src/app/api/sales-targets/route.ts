import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { SalesTargetService, upsertTargetSchema } from "@/services/sales-target.service";

export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const salespersonId = searchParams.get("salespersonId") ?? undefined;
  const periodYear = searchParams.get("periodYear") ? parseInt(searchParams.get("periodYear")!, 10) : undefined;
  const items = await SalesTargetService.listTargets({ salespersonId, periodYear });
  return successResponse(items);
});

export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();
  const data = upsertTargetSchema.parse(body);
  const target = await SalesTargetService.upsertTarget(data, user.id, user.role, ip ?? undefined);
  return successResponse(target);
});
