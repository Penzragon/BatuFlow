import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { JournalService } from "@/services/journal.service";

/**
 * POST /api/journal-entries/:id/post
 * Transitions a DRAFT journal entry to POSTED status.
 */
export const POST = apiHandler(async (req: Request, context: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const entry = await JournalService.postJournalEntry(id, user.id, user.role, ip ?? undefined);
  return successResponse(entry);
});
