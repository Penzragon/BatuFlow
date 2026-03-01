import { apiHandler, successResponse, errorResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import {
  markAsRead,
  markAllAsRead,
} from "@/services/notification.service";

interface MarkReadBody {
  notificationId?: string;
}

/**
 * POST /api/notifications/mark-read
 * Marks one notification or all notifications as read.
 * Body: { notificationId?: string } - if provided marks one, otherwise marks all
 */
export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();

  let body: MarkReadBody = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body.notificationId) {
    const updated = await markAsRead(body.notificationId, user.id);
    if (!updated) {
      return errorResponse("Notification not found", 404);
    }
    return successResponse({ marked: 1 });
  }

  const count = await markAllAsRead(user.id);
  return successResponse({ marked: count });
});
