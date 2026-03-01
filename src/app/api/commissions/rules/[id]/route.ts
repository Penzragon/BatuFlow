import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { CommissionService, updateRuleSchema } from "@/services/commission.service";

export const GET = apiHandler(async (req: Request, context?: unknown) => {
  await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const rule = await CommissionService.getRule(id);
  return successResponse(rule);
});

export const PUT = apiHandler(async (req: Request, context?: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await req.json();
  const data = updateRuleSchema.parse(body);
  const rule = await CommissionService.updateRule(id, data, user.id, user.role, ip ?? undefined);
  return successResponse(rule);
});

export const DELETE = apiHandler(async (req: Request, context?: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  await CommissionService.deleteRule(id, user.id, user.role, ip ?? undefined);
  return successResponse({ ok: true });
});
