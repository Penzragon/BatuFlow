import { Queue } from "bullmq";

const QUEUE_NAME = "audit-log";

let _queue: Queue | null = null;

/**
 * Lazily initializes and returns the BullMQ audit-log queue.
 * Deferred initialization prevents connection errors at build time
 * when Redis is not available. The queue connects on first use.
 */
export function getAuditQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(QUEUE_NAME, {
      connection: {
        host: process.env.REDIS_URL?.replace("redis://", "").split(":")[0] || "localhost",
        port: parseInt(process.env.REDIS_URL?.split(":")[2] || "6379", 10),
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }
  return _queue;
}

/** @deprecated Use getAuditQueue() instead */
export const auditQueue = {
  add: async (name: string, data: unknown) => getAuditQueue().add(name, data),
};
