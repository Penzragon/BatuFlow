import {
  apiHandler,
  successResponse,
  parsePaginationParams,
} from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { UserService } from "@/services/user.service";

/**
 * GET /api/users/me/activity
 * Returns the authenticated user's personal audit log entries
 * with pagination. Used in the Profile → My Activity section.
 */
export const GET = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const { page, pageSize } = parsePaginationParams(searchParams);
  const result = await UserService.getUserActivity(user.id, page, pageSize);
  return successResponse(result);
});
