import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { CommissionService, createRuleSchema } from "@/services/commission.service";

export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const salespersonId = searchParams.get("salespersonId") ?? undefined;
  const items = await CommissionService.listRules(salespersonId);
  return successResponse(items);
});

export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();
  const data = createRuleSchema.parse(body);
  const rule = await CommissionService.createRule(data, user.id, user.role, ip ?? undefined);
  return successResponse(rule, 201);
});
