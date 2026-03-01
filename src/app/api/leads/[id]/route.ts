import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { LeadService, updateLeadSchema } from "@/services/lead.service";

export const GET = apiHandler(async (req: Request, context?: unknown) => {
  await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const lead = await LeadService.getLead(id);
  return successResponse(lead);
});

export const PUT = apiHandler(async (req: Request, context?: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await req.json();
  const data = updateLeadSchema.parse(body);
  const lead = await LeadService.updateLead(id, data, user.id, user.role, ip ?? undefined);
  return successResponse(lead);
});

export const DELETE = apiHandler(async (req: Request, context?: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  await LeadService.deleteLead(id, user.id, user.role, ip ?? undefined);
  return successResponse({ ok: true });
});
