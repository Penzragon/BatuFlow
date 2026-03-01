import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { UserService, changePasswordSchema } from "@/services/user.service";

/**
 * POST /api/users/change-password
 * Allows the currently authenticated user to change their own password.
 * Requires the current password for verification.
 */
export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const body = await req.json();
  const data = changePasswordSchema.parse(body);
  await UserService.changePassword(
    user.id,
    data.currentPassword,
    data.newPassword
  );
  return successResponse({ changed: true });
});
