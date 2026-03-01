import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: IORedis | undefined;
};

/**
 * Lazily creates and returns a singleton Redis client.
 * Deferred initialization prevents connection errors at build time.
 */
export function getRedis(): IORedis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new IORedis(
      process.env.REDIS_URL || "redis://localhost:6379",
      { maxRetriesPerRequest: null }
    );
  }
  return globalForRedis.redis;
}

/**
 * Proxy export for backwards compatibility.
 * Accessing any property triggers lazy initialization.
 */
export const redis = new Proxy({} as IORedis, {
  get(_target, prop) {
    return (getRedis() as any)[prop];
  },
});
