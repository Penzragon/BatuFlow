import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import {
  globalSearch,
  saveRecentSearch,
} from "@/services/search.service";

/**
 * GET /api/search?q=<query>
 * Performs global search across Products and Customers.
 * Returns grouped results: { products: [...], customers: [...] }
 * Requires authentication. Saves to recent searches if query is valid (min 2 chars).
 */
export const GET = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return successResponse({
      products: [],
      customers: [],
      salesOrders: [],
      invoices: [],
      deliveryOrders: [],
      employees: [],
      expenses: [],
    });
  }

  const result = await globalSearch(query, user.id, user.role);
  await saveRecentSearch(user.id, query);

  return successResponse(result);
});
