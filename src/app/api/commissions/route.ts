import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { CommissionService, calculateCommissionSchema } from "@/services/commission.service";

export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);
  const salespersonId = searchParams.get("salespersonId") ?? undefined;
  const status = searchParams.get("status") as "DRAFT" | "CONFIRMED" | undefined;
  const result = await CommissionService.listCommissions({
    ...pagination,
    salespersonId,
    status,
  });
  return successResponse(result);
});

export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();
  const data = calculateCommissionSchema.parse(body);
  const commission = await CommissionService.calculateCommission(data, user.id, user.role, ip ?? undefined);
  return successResponse(commission, 201);
});
