import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { PickListService } from "@/services/pick-list.service";

export const GET = apiHandler(async (req) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);
  const status = searchParams.get("status") ?? undefined;
  const assignedTo = searchParams.get("assignedTo") ?? undefined;

  const result = await PickListService.listPickLists({ ...pagination, status, assignedTo });
  return successResponse(result);
});
