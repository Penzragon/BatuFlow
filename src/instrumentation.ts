/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Used to spin up background processes like the BullMQ audit worker
 * that must be running for queued audit log jobs to be written to the DB.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAuditWorker } = await import("@/services/audit.worker");
    startAuditWorker();
    console.log("[Instrumentation] Audit worker started");
  }
}
