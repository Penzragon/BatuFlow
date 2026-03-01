import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { getRecentSearches } from "@/services/search.service";

/**
 * GET /api/search/recent
 * Returns the last 5 recent searches for the current authenticated user.
 */
export const GET = apiHandler(async (_req: Request) => {
  const user = await getCurrentUser();

  const recent = await getRecentSearches(user.id);
  return successResponse(recent);
});
