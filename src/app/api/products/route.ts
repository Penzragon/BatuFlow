import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { getCurrentUser, requirePermission, getClientIp } from "@/lib/auth-utils";
import { ProductService, createProductSchema } from "@/services/product.service";

/**
 * GET /api/products
 * Returns a paginated list of products with optional search, category,
 * brand, and active-status filters read from query parameters.
 */
export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();

  const { searchParams } = new URL(req.url);
  const pagination = parsePaginationParams(searchParams);

  const category = searchParams.get("category") ?? undefined;
  const brand = searchParams.get("brand") ?? undefined;
  const isActiveRaw = searchParams.get("isActive");
  const isActive = isActiveRaw === null ? undefined : isActiveRaw === "true";

  const result = await ProductService.listProducts({
    ...pagination,
    category,
    brand,
    isActive,
  });

  return successResponse(result);
});

/**
 * POST /api/products
 * Creates a new product. Requires the inventory:create permission.
 * Request body is validated against createProductSchema.
 */
export const POST = apiHandler(async (req: Request) => {
  const user = await requirePermission("inventory", "create");
  const ip = getClientIp(req);
  const body = await req.json();
  const data = createProductSchema.parse(body);
  const product = await ProductService.createProduct(data, user.id, user.role, ip ?? undefined);
  return successResponse(product, 201);
});
