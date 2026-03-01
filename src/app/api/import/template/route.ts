import { apiHandler, successResponse, errorResponse } from "@/lib/api-utils";
import { requireRole } from "@/lib/auth-utils";
import { generateTemplate } from "@/services/import.service";

const VALID_TYPES = ["products", "customers", "accounts", "employees"] as const;

/**
 * GET /api/import/template?type=products|customers|accounts|employees
 * Returns an Excel template file for the specified import type.
 * Admin only.
 */
export const GET = apiHandler(async (req: Request) => {
  await requireRole(["ADMIN"]);

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (!type || !VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    return errorResponse(
      `Missing or invalid type. Must be one of: ${VALID_TYPES.join(", ")}`,
      400
    );
  }

  const buffer = generateTemplate(type);
  const filename = `import-${type}-template.xlsx`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
});
