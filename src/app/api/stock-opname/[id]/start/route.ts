import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { StockOpnameService } from "@/services/stock-opname.service";

export const POST = apiHandler(async (req, context) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await req.json().catch(() => ({}));
  const countedBy = body.countedBy ?? user.id;

  const opname = await StockOpnameService.startCounting(id, countedBy, user.id, user.role, ip ?? undefined);
  return successResponse(opname);
});
