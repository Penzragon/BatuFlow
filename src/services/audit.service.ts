import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuditQueue } from "./audit.queue";
import type { AuditChange } from "@/types";

const SKIP_FIELDS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "passwordHash",
  "password_hash",
]);

/**
 * Converts a value to a string for audit comparison and storage.
 * Handles null, undefined, objects, and Date instances.
 */
function valueToString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Core audit service for the BatuFlow ERP.
 * Centralized audit logging that tracks create/update/delete operations
 * with field-level change diffs. Uses BullMQ for async writes with
 * synchronous DB fallback when Redis is unavailable.
 */
export class AuditService {
  /**
   * Computes field-level diffs between old and new records.
   * Compares each field and returns an array of changes where values differ.
   * Skips internal fields like createdAt, updatedAt, passwordHash.
   */
  static computeChanges(
    oldData: Record<string, unknown> | null,
    newData: Record<string, unknown>
  ): AuditChange[] {
    const changes: AuditChange[] = [];
    const allKeys = new Set([
      ...(oldData ? Object.keys(oldData) : []),
      ...Object.keys(newData),
    ]);

    for (const field of allKeys) {
      if (SKIP_FIELDS.has(field)) continue;

      const oldVal = oldData?.[field];
      const newVal = newData[field];

      const oldStr = valueToString(oldVal);
      const newStr = valueToString(newVal);

      if (oldStr !== newStr) {
        changes.push({
          field,
          oldValue: oldStr,
          newValue: newStr,
        });
      }
    }

    return changes;
  }

  /**
   * Writes an audit log and its changes directly to the database.
   * Used by the worker and as fallback when Redis is unavailable.
   */
  static async writeToDb(payload: {
    action: AuditAction;
    userId: string;
    userRole: string;
    ipAddress?: string;
    entityType: string;
    entityId: string;
    entityLabel?: string;
    changes: AuditChange[];
    metadata?: unknown;
  }): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        userRole: payload.userRole,
        ipAddress: payload.ipAddress ?? null,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId,
        entityLabel: payload.entityLabel ?? null,
        metadata: (payload.metadata ?? undefined) as any,
        changes: {
          create: payload.changes.map((c) => ({
            fieldName: c.field,
            oldValue: c.oldValue,
            newValue: c.newValue,
          })),
        },
      },
    });
  }

  /**
   * Writes an audit log entry, choosing the best available strategy:
   *   1. If Redis is reachable, enqueue via BullMQ for async processing
   *      by the audit worker (non-blocking for the caller).
   *   2. If the queue add fails (Redis down, connection error, etc.),
   *      fall back to a direct synchronous database write so the
   *      audit entry is never silently lost.
   *
   * Both paths are wrapped in try/catch so that a logging failure
   * can never crash the business operation that triggered it.
   */
  private static async enqueueOrWrite(payload: {
    action: AuditAction;
    userId: string;
    userRole: string;
    ipAddress?: string;
    entityType: string;
    entityId: string;
    entityLabel?: string;
    changes: AuditChange[];
    metadata?: unknown;
  }): Promise<void> {
    try {
      const queue = getAuditQueue();
      const isReady = await queue.client
        .then((c) => c.status === "ready")
        .catch(() => false);

      if (isReady) {
        await queue.add("audit", payload);
        return;
      }
    } catch {
      // Redis unreachable — fall through to direct write
    }

    // Fallback: write directly to database
    try {
      await AuditService.writeToDb(payload);
    } catch (err) {
      console.error("[AuditService] Failed to write audit log:", err);
    }
  }

  /**
   * Logs a CREATE action. Records all initial field values as changes
   * (old_value = null, new_value = the value).
   */
  static async logCreate(params: {
    userId: string;
    userRole: string;
    ipAddress?: string;
    entityType: string;
    entityId: string;
    entityLabel?: string;
    data: Record<string, unknown>;
    metadata?: unknown;
  }): Promise<void> {
    const changes: AuditChange[] = Object.entries(params.data)
      .filter(([field]) => !SKIP_FIELDS.has(field))
      .map(([field, val]) => ({
        field,
        oldValue: null,
        newValue: valueToString(val),
      }));

    await AuditService.enqueueOrWrite({
      action: AuditAction.CREATE,
      userId: params.userId,
      userRole: params.userRole,
      ipAddress: params.ipAddress,
      entityType: params.entityType,
      entityId: params.entityId,
      entityLabel: params.entityLabel,
      changes,
      metadata: params.metadata,
    });
  }

  /**
   * Logs an UPDATE action. Computes field-level diffs between old and new data.
   * Only creates change records for fields that actually changed.
   */
  static async logUpdate(params: {
    userId: string;
    userRole: string;
    ipAddress?: string;
    entityType: string;
    entityId: string;
    entityLabel?: string;
    oldData: Record<string, unknown>;
    newData: Record<string, unknown>;
    metadata?: unknown;
  }): Promise<void> {
    const changes = AuditService.computeChanges(
      params.oldData,
      params.newData
    );

    if (changes.length === 0) return;

    await AuditService.enqueueOrWrite({
      action: AuditAction.UPDATE,
      userId: params.userId,
      userRole: params.userRole,
      ipAddress: params.ipAddress,
      entityType: params.entityType,
      entityId: params.entityId,
      entityLabel: params.entityLabel,
      changes,
      metadata: params.metadata,
    });
  }

  /**
   * Logs a DELETE action. Records the full record snapshot before deletion.
   */
  static async logDelete(params: {
    userId: string;
    userRole: string;
    ipAddress?: string;
    entityType: string;
    entityId: string;
    entityLabel?: string;
    data: Record<string, unknown>;
    metadata?: unknown;
  }): Promise<void> {
    const changes: AuditChange[] = Object.entries(params.data)
      .filter(([field]) => !SKIP_FIELDS.has(field))
      .map(([field, val]) => ({
        field,
        oldValue: valueToString(val),
        newValue: null,
      }));

    await AuditService.enqueueOrWrite({
      action: AuditAction.DELETE,
      userId: params.userId,
      userRole: params.userRole,
      ipAddress: params.ipAddress,
      entityType: params.entityType,
      entityId: params.entityId,
      entityLabel: params.entityLabel,
      changes,
      metadata: params.metadata,
    });
  }

  /**
   * Logs an APPROVE or REJECT action.
   */
  static async logApproval(params: {
    userId: string;
    userRole: string;
    ipAddress?: string;
    entityType: string;
    entityId: string;
    entityLabel?: string;
    action: "APPROVE" | "REJECT";
    metadata?: unknown;
  }): Promise<void> {
    const action =
      params.action === "APPROVE" ? AuditAction.APPROVE : AuditAction.REJECT;

    await AuditService.enqueueOrWrite({
      action,
      userId: params.userId,
      userRole: params.userRole,
      ipAddress: params.ipAddress,
      entityType: params.entityType,
      entityId: params.entityId,
      entityLabel: params.entityLabel,
      changes: [],
      metadata: params.metadata,
    });
  }

  /**
   * Logs an EXPORT action (who exported what report).
   * Uses entityType as entityId when no specific entity is involved.
   */
  static async logExport(params: {
    userId: string;
    userRole: string;
    ipAddress?: string;
    entityType: string;
    entityLabel?: string;
    metadata?: unknown;
  }): Promise<void> {
    const entityId =
      (params.metadata as { entityId?: string })?.entityId ?? params.entityType;

    await AuditService.enqueueOrWrite({
      action: AuditAction.EXPORT,
      userId: params.userId,
      userRole: params.userRole,
      ipAddress: params.ipAddress,
      entityType: params.entityType,
      entityId,
      entityLabel: params.entityLabel,
      changes: [],
      metadata: params.metadata,
    });
  }
}
