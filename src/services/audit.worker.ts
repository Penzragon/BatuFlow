import { Worker } from "bullmq";
import { AuditAction } from "@prisma/client";
import { AuditService } from "./audit.service";

const QUEUE_NAME = "audit-log";

function resolveRedisConnection() {
  const raw = process.env.REDIS_URL;

  if (!raw) {
    return { host: "localhost", port: 6379 };
  }

  try {
    const url = new URL(raw);
    const host = url.hostname || "localhost";
    const port = Number.parseInt(url.port || "6379", 10);

    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      console.warn(`[AuditWorker] Invalid REDIS_URL port '${url.port}'. Falling back to 6379.`);
      return { host, port: 6379 };
    }

    return { host, port };
  } catch {
    console.warn("[AuditWorker] REDIS_URL is not a valid URL. Falling back to localhost:6379.");
    return { host: "localhost", port: 6379 };
  }
}

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
        ...resolveRedisConnection(),
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
