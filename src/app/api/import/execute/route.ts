import {
  apiHandler,
  successResponse,
  errorResponse,
} from "@/lib/api-utils";
import { requireRole, getClientIp } from "@/lib/auth-utils";
import { executeImport } from "@/services/import.service";

const VALID_TYPES = ["products", "customers", "accounts", "employees"] as const;

/**
 * POST /api/import/execute
 * Accepts JSON body with type and validRows array.
 * Executes the import transactionally.
 * Admin only.
 */
export const POST = apiHandler(async (req: Request) => {
  const user = await requireRole(["ADMIN"]);
  const ip = getClientIp(req);

  const body = await req.json();
  const { type, validRows, fileName } = body as {
    type?: string;
    validRows?: Record<string, unknown>[];
    fileName?: string;
  };

  if (!type || !VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    return errorResponse(
      `Missing or invalid type. Must be one of: ${VALID_TYPES.join(", ")}`,
      400
    );
  }

  if (!Array.isArray(validRows)) {
    return errorResponse("validRows must be an array", 400);
  }

  if (validRows.length > 5000) {
    return errorResponse("Maximum 5000 rows per import", 400);
  }

  try {
    const result = await executeImport(
      type,
      validRows,
      user.id,
      user.role,
      ip ?? undefined,
      fileName
    );

    return successResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return errorResponse(message, 500);
  }
});
