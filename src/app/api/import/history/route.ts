import { apiHandler, successResponse } from "@/lib/api-utils";
import { requireRole } from "@/lib/auth-utils";
import { getImportHistory } from "@/services/import.service";

/**
 * GET /api/import/history
 * Returns recent import logs for the import history section.
 * Admin only.
 */
export const GET = apiHandler(async (req: Request) => {
  await requireRole(["ADMIN"]);

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20)
  );

  const logs = await getImportHistory(limit);
  return successResponse(logs);
});
