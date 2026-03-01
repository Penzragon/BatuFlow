import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { getNotifications } from "@/services/notification.service";

/**
 * GET /api/notifications
 * Returns paginated notifications for the current user.
 * Query params: page, pageSize, unreadOnly
 */
export const GET = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const { page, pageSize } = parsePaginationParams(searchParams);
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  const result = await getNotifications(user.id, {
    page,
    pageSize,
    unreadOnly,
  });

  return successResponse(result);
});
