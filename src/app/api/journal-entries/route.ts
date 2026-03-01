import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { JournalService, createJournalEntrySchema } from "@/services/journal.service";

/**
 * GET /api/journal-entries
 * Paginated list with status, dateFrom, dateTo, and referenceType filters.
 */
export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);
  const status = searchParams.get("status") ?? undefined;
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;
  const referenceType = searchParams.get("referenceType") ?? undefined;

  const result = await JournalService.listJournalEntries({
    ...pagination,
    status,
    dateFrom,
    dateTo,
    referenceType,
  });
  return successResponse(result);
});

/**
 * POST /api/journal-entries
 * Creates a new journal entry in DRAFT status.
 */
export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const body = await req.json();
  const data = createJournalEntrySchema.parse(body);
  const entry = await JournalService.createJournalEntry(data, user.id, user.role, ip ?? undefined);
  return successResponse(entry, 201);
});
