/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Used to spin up background processes like the BullMQ audit worker
 * when Redis is available (e.g. local Docker). On Vercel without Redis,
 * the worker is skipped; audit logs are still written via direct DB fallback.
 */
export async function register() {
  const isVercel = process.env.VERCEL === "1";
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.REDIS_URL && !isVercel) {
    const { startAuditWorker } = await import("@/services/audit.worker");
    startAuditWorker();
    console.log("[Instrumentation] Audit worker started");
    return;
  }

  if (isVercel) {
    console.log("[Instrumentation] Audit worker skipped on Vercel runtime");
  }
}
