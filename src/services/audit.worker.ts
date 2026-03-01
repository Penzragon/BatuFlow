import { Worker } from "bullmq";
import { AuditAction } from "@prisma/client";
import { AuditService } from "./audit.service";

const QUEUE_NAME = "audit-log";

interface AuditJobData {
  action: string;
  userId: string;
  userRole: string;
  ipAddress?: string;
  entityType: string;
  entityId: string;
  entityLabel?: string;
  changes: Array<{ field: string; oldValue: string | null; newValue: string | null }>;
  metadata?: unknown;
}

let _worker: Worker<AuditJobData> | null = null;

/**
 * Starts the BullMQ audit worker if not already running.
 * Call this from a separate process or server startup script
 * to begin processing queued audit log entries.
 */
export function startAuditWorker(): Worker<AuditJobData> {
  if (_worker) return _worker;

  _worker = new Worker<AuditJobData>(
    QUEUE_NAME,
    async (job) => {
      const { action, userId, userRole, ipAddress, entityType, entityId, entityLabel, changes, metadata } =
        job.data;

      await AuditService.writeToDb({
        action: action as AuditAction,
        userId,
        userRole,
        ipAddress,
        entityType,
        entityId,
        entityLabel,
        changes,
        metadata,
      });
    },
    {
      connection: {
        host: process.env.REDIS_URL?.replace("redis://", "").split(":")[0] || "localhost",
        port: parseInt(process.env.REDIS_URL?.split(":")[2] || "6379", 10),
        maxRetriesPerRequest: null,
      },
      concurrency: 5,
    }
  );

  _worker.on("failed", (job, err) => {
    console.error(`[AuditWorker] Job ${job?.id} failed:`, err?.message);
  });

  _worker.on("error", (err) => {
    console.error("[AuditWorker] Worker error:", err?.message);
  });

  return _worker;
}
