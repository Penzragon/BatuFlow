import type { PaginationParams } from "@/types";

function safeDbTarget() {
  const raw =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL ??
    null;

  if (!raw) return { dbTarget: "(missing DATABASE_URL)" };

  try {
    const u = new URL(raw);
    const host = u.host;
    const db = u.pathname?.replace(/^\//, "") || "(unknown-db)";
    const pooled = host.includes("-pooler.");
    const hasPgbouncer = u.searchParams.get("pgbouncer") === "true";
    return {
      dbTarget: `${u.protocol}//${host}/${db}`,
      dbPooled: pooled,
      dbPgbouncer: hasPgbouncer,
    };
  } catch {
    return { dbTarget: "(unparseable DATABASE_URL)" };
  }
}

/**
 * Wraps an API route handler with standard error handling.
 * Catches errors and returns appropriate JSON responses with status codes.
 */
export function apiHandler(
  handler: (req: Request, context?: unknown) => Promise<Response>
) {
  return async (req: Request, context?: unknown): Promise<Response> => {
    try {
      return await handler(req, context);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      try {
        console.error("[apiHandler]", req.method, new URL(req.url).pathname, message, safeDbTarget());
      } catch {
        console.error("[apiHandler]", message, safeDbTarget());
      }
      const status = err instanceof Error && "status" in err
        ? (err as Error & { status: number }).status
        : 500;
      return errorResponse(message, status);
    }
  };
}

/**
 * Creates a standard JSON success response.
 */
export function successResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/**
 * Creates a standard JSON error response.
 */
export function errorResponse(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

/**
 * Parses pagination params from URL search params.
 * Defaults: page=1, pageSize=20, sortOrder=desc
 */
export function parsePaginationParams(
  searchParams: URLSearchParams
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20)
  );
  const sortOrder =
    searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
  const sortBy = searchParams.get("sortBy") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  return {
    page,
    pageSize,
    sortOrder,
    sortBy,
    search,
  };
}
