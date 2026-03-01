import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import type { PaginatedResponse, PaginationParams } from "@/types";

/** Validation schema for creating a new user. */
export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "MANAGER", "STAFF", "DRIVER", "WAREHOUSE_STAFF"]),
  isActive: z.boolean().default(true),
});

/** Validation schema for updating an existing user (all fields optional). */
export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z
    .enum(["ADMIN", "MANAGER", "STAFF", "DRIVER", "WAREHOUSE_STAFF"])
    .optional(),
  isActive: z.boolean().optional(),
});

/** Validation schema for changing a user's own password. */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

/** User record shape returned by list/get operations (excludes passwordHash). */
interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SALT_ROUNDS = 10;

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Service layer for user management operations.
 * Handles CRUD, password hashing, pagination, and audit logging
 * for the User Management section of the Settings module.
 */
export class UserService {
  /**
   * Returns a paginated list of users with optional search by name or email.
   * Excludes soft-deleted users (deletedAt != null).
   */
  static async listUsers(
    params: PaginationParams
  ): Promise<PaginatedResponse<UserRecord>> {
    const { page, pageSize, search, sortBy, sortOrder } = params;
    const skip = (page - 1) * pageSize;

    const where = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const orderBy = sortBy
      ? { [sortBy]: sortOrder ?? "desc" }
      : { createdAt: sortOrder ?? "desc" as const };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Retrieves a single user by ID. Throws if not found or soft-deleted.
   */
  static async getUser(id: string): Promise<UserRecord> {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: USER_SELECT,
    });

    if (!user) {
      const err = new Error("User not found");
      (err as Error & { status: number }).status = 404;
      throw err;
    }

    return user;
  }

  /**
   * Creates a new user with a hashed password.
   * Logs the creation in the audit trail.
   */
  static async createUser(
    data: z.infer<typeof createUserSchema>,
    adminId: string,
    adminRole: string,
    ipAddress?: string
  ): Promise<UserRecord> {
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (existing) {
      const err = new Error("Email already in use");
      (err as Error & { status: number }).status = 409;
      throw err;
    }

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase().trim(),
        passwordHash,
        role: data.role,
        isActive: data.isActive,
      },
      select: USER_SELECT,
    });

    await AuditService.logCreate({
      userId: adminId,
      userRole: adminRole,
      ipAddress,
      entityType: "User",
      entityId: user.id,
      entityLabel: user.name,
      data: { name: user.name, email: user.email, role: user.role, isActive: user.isActive },
    });

    return user;
  }

  /**
   * Updates an existing user's fields. If a new password is provided it is hashed.
   * Logs field-level changes in the audit trail.
   */
  static async updateUser(
    id: string,
    data: z.infer<typeof updateUserSchema>,
    adminId: string,
    adminRole: string,
    ipAddress?: string
  ): Promise<UserRecord> {
    const existing = await prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      const err = new Error("User not found");
      (err as Error & { status: number }).status = 404;
      throw err;
    }

    if (data.email && data.email !== existing.email) {
      const dup = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase().trim() },
      });
      if (dup && dup.id !== id) {
        const err = new Error("Email already in use");
        (err as Error & { status: number }).status = 409;
        throw err;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined)
      updateData.email = data.email.toLowerCase().trim();
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: USER_SELECT,
    });

    const oldSnapshot: Record<string, unknown> = {
      name: existing.name,
      email: existing.email,
      role: existing.role,
      isActive: existing.isActive,
    };
    const newSnapshot: Record<string, unknown> = {
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };

    await AuditService.logUpdate({
      userId: adminId,
      userRole: adminRole,
      ipAddress,
      entityType: "User",
      entityId: user.id,
      entityLabel: user.name,
      oldData: oldSnapshot,
      newData: newSnapshot,
    });

    return user;
  }

  /**
   * Soft-deactivates a user by setting isActive to false.
   * Logs the deactivation in the audit trail.
   */
  static async deactivateUser(
    id: string,
    adminId: string,
    adminRole: string,
    ipAddress?: string
  ): Promise<UserRecord> {
    const existing = await prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      const err = new Error("User not found");
      (err as Error & { status: number }).status = 404;
      throw err;
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
      select: USER_SELECT,
    });

    await AuditService.logDelete({
      userId: adminId,
      userRole: adminRole,
      ipAddress,
      entityType: "User",
      entityId: user.id,
      entityLabel: user.name,
      data: { name: existing.name, email: existing.email, role: existing.role },
    });

    return user;
  }

  /**
   * Changes a user's own password after verifying the current password.
   * Returns true on success, throws on verification failure.
   */
  static async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      const err = new Error("User not found");
      (err as Error & { status: number }).status = 404;
      throw err;
    }

    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) {
      const err = new Error("Current password is incorrect");
      (err as Error & { status: number }).status = 400;
      throw err;
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return true;
  }

  /**
   * Returns a paginated list of audit log entries for a specific user,
   * ordered by most recent first. Used in the "My Activity" section.
   */
  static async getUserActivity(
    userId: string,
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResponse<unknown>> {
    const skip = (page - 1) * pageSize;

    const where = { userId };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip,
        take: pageSize,
        include: { changes: true },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
