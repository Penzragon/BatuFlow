import { apiHandler, successResponse, errorResponse } from "@/lib/api-utils";
import { requireRole } from "@/lib/auth-utils";
import {
  parseExcelFile,
  validateImport,
} from "@/services/import.service";

const VALID_TYPES = ["products", "customers", "accounts", "employees"] as const;

/**
 * POST /api/import/validate
 * Accepts multipart form data with file and type.
 * Parses Excel file, validates rows, returns validation result.
 * Admin only.
 */
export const POST = apiHandler(async (req: Request) => {
  await requireRole(["ADMIN"]);

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string | null;

  if (!type || !VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    return errorResponse(
      `Missing or invalid type. Must be one of: ${VALID_TYPES.join(", ")}`,
      400
    );
  }

  if (!file || !(file instanceof File)) {
    return errorResponse("Missing or invalid file", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const data = parseExcelFile(buffer);
    const result = await validateImport(type, data);

    return successResponse({
      validRows: result.validRows,
      errors: result.errors,
      totalRows: result.totalRows,
      rows: data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse file";
    return errorResponse(message, 422);
  }
});
