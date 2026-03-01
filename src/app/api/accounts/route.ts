import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { AccountService, createAccountSchema } from "@/services/account.service";

/**
 * GET /api/accounts
 * Paginated list of chart-of-accounts with optional type filter.
 */
export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);
  const type = searchParams.get("type") ?? undefined;

  const result = await AccountService.listAccounts({ ...pagination, type });
  return successResponse(result);
});

/**
 * POST /api/accounts
 * Creates a new chart-of-accounts entry.
 */
export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();
  const data = createAccountSchema.parse(body);
  const account = await AccountService.createAccount(data, user.id, user.role, ip ?? undefined);
  return successResponse(account, 201);
});
