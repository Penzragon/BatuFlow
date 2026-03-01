import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { getUnreadCount } from "@/services/notification.service";

/**
 * GET /api/notifications/unread-count
 * Returns the count of unread notifications for the current user.
 */
export const GET = apiHandler(async (_req: Request) => {
  const user = await getCurrentUser();
  const count = await getUnreadCount(user.id);
  return successResponse({ count });
});
