import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { CustomerActivityService, createActivitySchema } from "@/services/customer-activity.service";

export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);
  const customerId = searchParams.get("customerId") ?? undefined;
  const leadId = searchParams.get("leadId") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const type = searchParams.get("type") as "CALL" | "VISIT" | "NOTE" | "EMAIL" | "MEETING" | undefined;
  const result = await CustomerActivityService.listActivities({
    ...pagination,
    customerId,
    leadId,
    userId,
    type,
  });
  return successResponse(result);
});

export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();
  const data = createActivitySchema.parse(body);
  const activity = await CustomerActivityService.createActivity(data, user.id, user.role, ip ?? undefined);
  return successResponse(activity, 201);
});
