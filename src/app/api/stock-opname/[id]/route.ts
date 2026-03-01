import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { StockOpnameService } from "@/services/stock-opname.service";

export const GET = apiHandler(async (_req, context) => {
  await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const opname = await StockOpnameService.getOpname(id);
  return successResponse(opname);
});
