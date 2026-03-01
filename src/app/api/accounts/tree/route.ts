import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { AccountService } from "@/services/account.service";

/**
 * GET /api/accounts/tree
 * Returns the full chart-of-accounts as a nested tree structure.
 */
export const GET = apiHandler(async () => {
  await getCurrentUser();
  const tree = await AccountService.getAccountTree();
  return successResponse(tree);
});
