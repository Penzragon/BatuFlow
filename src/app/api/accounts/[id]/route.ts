import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { AccountService, updateAccountSchema } from "@/services/account.service";

export const GET = apiHandler(async (_req: Request, context: unknown) => {
  await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const account = await AccountService.getAccount(id);
  return successResponse(account);
});

export const PUT = apiHandler(async (req: Request, context: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await req.json();
  const data = updateAccountSchema.parse(body);
  const account = await AccountService.updateAccount(id, data, user.id, user.role, ip ?? undefined);
  return successResponse(account);
});

export const DELETE = apiHandler(async (req: Request, context: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  await AccountService.deleteAccount(id, user.id, user.role, ip ?? undefined);
  return successResponse({ deleted: true });
});
