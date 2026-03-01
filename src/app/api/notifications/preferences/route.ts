import { apiHandler, successResponse, errorResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import {
  getPreferences,
  updatePreference,
  NOTIFICATION_TYPES,
} from "@/services/notification.service";

/**
 * GET /api/notifications/preferences
 * Returns notification preferences for the current user.
 */
export const GET = apiHandler(async (_req: Request) => {
  const user = await getCurrentUser();
  const preferences = await getPreferences(user.id);
  return successResponse(preferences);
});

interface PutPreferencesBody {
  type: string;
  enabled: boolean;
}

/**
 * PUT /api/notifications/preferences
 * Updates a single notification type preference.
 * Body: { type: string, enabled: boolean }
 */
export const PUT = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();

  const body = (await req.json()) as PutPreferencesBody;
  const { type, enabled } = body;

  if (!type || typeof enabled !== "boolean") {
    return errorResponse("type and enabled are required", 400);
  }

  const validType = NOTIFICATION_TYPES.includes(
    type as (typeof NOTIFICATION_TYPES)[number]
  );
  if (!validType) {
    return errorResponse(
      `Invalid type. Must be one of: ${NOTIFICATION_TYPES.join(", ")}`,
      400
    );
  }

  await updatePreference(user.id, type, enabled);
  const preferences = await getPreferences(user.id);
  return successResponse(preferences);
});
