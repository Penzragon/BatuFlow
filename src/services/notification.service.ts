import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { UserRole } from "@prisma/client";

/** Default notification types that users can toggle. */
export const NOTIFICATION_TYPES = [
  "low_stock",
  "expense_approval",
  "leave_approval",
  "so_approval",
  "invoice_overdue",
  "pick_list_assigned",
  "trip_assigned",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface GetNotificationsParams {
  /** Page number (1-based). */
  page?: number;
  /** Number of items per page. */
  pageSize?: number;
  /** If true, return only unread notifications. */
  unreadOnly?: boolean;
}

export interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

export interface BulkNotificationItem {
  userId: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

/**
 * Get paginated notifications for a user.
 * Supports filtering by read status and standard pagination.
 */
export async function getNotifications(
  userId: string,
  params: GetNotificationsParams = {}
) {
  const { page = 1, pageSize = 20, unreadOnly = false } = params;

  const where = {
    userId,
    ...(unreadOnly ? { isRead: false } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
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
 * Get the count of unread notifications for a user.
 * Used for badge display in the notification bell.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
}

/**
 * Mark a single notification as read.
 * Verifies the notification belongs to the user before updating.
 */
export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
    },
    data: { isRead: true },
  });
  return result.count > 0;
}

/**
 * Mark all notifications as read for a user.
 * Used when the user clicks "Mark all as read" in the notification dropdown.
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return result.count;
}

/**
 * Create a new notification for a user.
 * Optionally links to an entity (e.g. product, customer) for navigation.
 */
export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      title: params.title,
      message: params.message,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
    },
  });
}

/**
 * Create multiple notifications at once.
 * Useful for broadcasting alerts to managers or warehouse staff.
 */
export async function createBulkNotifications(
  notifications: BulkNotificationItem[]
) {
  if (notifications.length === 0) return [];

  return prisma.notification.createManyAndReturn({
    data: notifications.map((n) => ({
      userId: n.userId,
      title: n.title,
      message: n.message,
      entityType: n.entityType ?? null,
      entityId: n.entityId ?? null,
    })),
  });
}

/**
 * Get notification preferences for a user.
 * Returns a map of notification type to enabled status.
 * Types not in the DB default to enabled.
 */
export async function getPreferences(
  userId: string
): Promise<Record<string, boolean>> {
  const prefs = await prisma.notificationPreference.findMany({
    where: { userId },
  });

  const map: Record<string, boolean> = {};
  for (const type of NOTIFICATION_TYPES) {
    const p = prefs.find((x) => x.notificationType === type);
    map[type] = p?.enabled ?? true;
  }
  return map;
}

/**
 * Toggle a notification type on or off for a user.
 * Creates the preference record if it does not exist.
 */
export async function updatePreference(
  userId: string,
  type: string,
  enabled: boolean
) {
  return prisma.notificationPreference.upsert({
    where: {
      userId_notificationType: {
        userId,
        notificationType: type,
      },
    },
    update: { enabled },
    create: {
      userId,
      notificationType: type,
      enabled,
    },
  });
}

/**
 * Check products below minimum stock and create notifications for managers and warehouse staff.
 * Skips users who have disabled low_stock notifications.
 * Creates one notification per low-stock product per eligible user.
 */
export async function checkLowStockAlerts(): Promise<number> {
  const eligibleRoles: UserRole[] = ["MANAGER", "WAREHOUSE_STAFF", "ADMIN"];

  const users = await prisma.user.findMany({
    where: {
      role: { in: eligibleRoles },
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });

  const usersWithLowStockEnabled = await Promise.all(
    users.map(async (u) => {
      const prefs = await getPreferences(u.id);
      return prefs.low_stock ? u.id : null;
    })
  );
  const recipientIds = usersWithLowStockEnabled.filter(
    (id): id is string => id != null
  );
  if (recipientIds.length === 0) return 0;

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      minStock: { gt: 0 },
    },
    select: {
      id: true,
      sku: true,
      name: true,
      minStock: true,
    },
  });

  if (products.length === 0) return 0;

  const productIds = products.map((p) => p.id);

  type StockRow = { product_id: string; current_stock: number };
  const rows = await prisma.$queryRaw<StockRow[]>`
    SELECT sl.product_id,
      SUM(CASE
        WHEN sl.movement_type = 'STOCK_IN' THEN sl.qty
        WHEN sl.movement_type = 'STOCK_OUT' THEN -sl.qty
        ELSE sl.qty
      END)::float AS current_stock
    FROM stock_ledger sl
    WHERE sl.product_id IN (${Prisma.join(productIds)})
    GROUP BY sl.product_id
  `;

  const stockMap = new Map(rows.map((r) => [r.product_id, Math.max(0, Number(r.current_stock) || 0)]));

  const lowStockProducts = products.filter((p) => {
    const currentStock = stockMap.get(p.id) ?? 0;
    return currentStock < p.minStock;
  });

  if (lowStockProducts.length === 0) return 0;

  const notifications: BulkNotificationItem[] = [];
  for (const product of lowStockProducts) {
    const total = stockMap.get(product.id) ?? 0;
    const displayQty = Math.max(0, total);
    const title = "Low stock alert";
    const message = `${product.name} (${product.sku}): ${displayQty} in stock, minimum ${product.minStock}`;

    for (const userId of recipientIds) {
      notifications.push({
        userId,
        title,
        message,
        entityType: "product",
        entityId: product.id,
      });
    }
  }

  const created = await createBulkNotifications(notifications);
  return created.length;
}
