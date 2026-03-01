import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { LeadService, createLeadSchema } from "@/services/lead.service";

export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);
  const status = searchParams.get("status") ?? undefined;
  const assignedTo = searchParams.get("assignedTo") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const result = await LeadService.listLeads({
    ...pagination,
    status: status as "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL" | "WON" | "LOST" | undefined,
    assignedTo,
    search,
  });
  return successResponse(result);
});

export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();
  const data = createLeadSchema.parse(body);
  const lead = await LeadService.createLead(data, user.id, user.role, ip ?? undefined);
  return successResponse(lead, 201);
});
