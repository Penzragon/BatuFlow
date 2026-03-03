import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { parsePaginationParams } from "@/lib/api-utils";
import { VisitService } from "@/services/visit.service";

export const GET = apiHandler(async (req) => {
  const user = await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);

  const result = await VisitService.listVisits({
    ...pagination,
    salespersonId: searchParams.get("salespersonId") ?? undefined,
    customerId: searchParams.get("customerId") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    viewer: { id: user.id, role: user.role },
  });

  return successResponse({
    ...result,
    items: result.items.map((visit) => {
      const checkoutAt = (visit as { checkoutAt?: Date | null }).checkoutAt ?? null;
      const checkInAt = (visit as { checkInAt?: Date | null }).checkInAt ?? null;
      const durationMinutes = checkoutAt && checkInAt
        ? Math.max(0, Math.round((new Date(checkoutAt).getTime() - new Date(checkInAt).getTime()) / 60000))
        : null;

      return {
        ...visit,
        lifecycle: {
          status: (visit as { status?: string }).status ?? null,
          checkoutAt,
          durationMinutes,
        },
      };
    }),
  });
});
