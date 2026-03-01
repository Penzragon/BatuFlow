import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

/** Product with low stock (current < minStock) */
export interface LowStockProduct {
  id: string;
  sku: string;
  name: string;
  minStock: number;
  currentStock: number;
}

/** Single audit log entry with user info and changes for dashboard display */
export interface RecentActivityItem {
  id: string;
  timestamp: Date;
  action: string;
  entityType: string;
  entityLabel: string | null;
  entityId: string;
  userName: string;
  changesCount: number;
}

/** Dashboard stats for KPI cards */
export interface DashboardStats {
  totalProducts: number;
  totalCustomers: number;
  totalWarehouses: number;
  lowStockCount: number;
  todaysSales: number;
  yesterdaySales: number;
  outstandingAR: number;
}

/** Daily sales for monthly trend chart */
export interface DailySalesItem {
  date: string;
  amount: number;
}

/** Top product by qty/revenue */
export interface TopProductItem {
  id: string;
  name: string;
  sku: string;
  qty: number;
  revenue: number;
}

/** Top customer by spending */
export interface TopCustomerItem {
  id: string;
  name: string;
  totalAmount: number;
  invoiceCount: number;
}

/** Pending approval counts */
export interface PendingApprovals {
  soCount: number;
  expenseCount: number;
  leaveCount: number;
  total: number;
}

/** Today's trip for deliveries widget */
export interface TodayTripItem {
  id: string;
  tripNumber: string;
  driverName: string;
  status: string;
  doCount: number;
}

/** Salesperson performance row */
export interface SalespersonPerformanceItem {
  userId: string;
  userName: string;
  salesAmount: number;
  visitCount: number;
}

/** Dashboard API response shape (Admin/Manager) */
export interface DashboardData {
  stats: DashboardStats;
  lowStockProducts: LowStockProduct[];
  recentActivity: RecentActivityItem[];
  arAging: { label: string; amount: number }[];
  monthlySalesTrend: DailySalesItem[];
  topProducts: TopProductItem[];
  topCustomers: TopCustomerItem[];
  pendingApprovals: PendingApprovals;
  todaysDeliveries: TodayTripItem[];
  salespersonPerformance: SalespersonPerformanceItem[];
}

/** Staff/Salesperson dashboard data */
export interface StaffDashboardData {
  mySalesToday: number;
  myMonthlyTarget: number;
  myMonthlyActual: number;
  myOpenSoCount: number;
  myPendingCommission: number;
  recentActivity: RecentActivityItem[];
}

/**
 * Returns products that are below minimum stock level.
 * Aggregates current stock from StockLedger (STOCK_IN +, STOCK_OUT -, ADJUSTMENT/OPNAME as qty).
 */
export async function getLowStockProducts(): Promise<LowStockProduct[]> {
  const products = await prisma.product.findMany({
    where: {
      minStock: { gt: 0 },
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      sku: true,
      name: true,
      minStock: true,
    },
    orderBy: { minStock: "desc" },
  });

  if (products.length === 0) return [];

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

  const stockMap = new Map(
    rows.map((r) => [r.product_id, Math.max(0, Number(r.current_stock) || 0)])
  );

  const result: LowStockProduct[] = [];
  for (const p of products) {
    const currentStock = stockMap.get(p.id) ?? 0;
    if (currentStock < p.minStock) {
      result.push({
        id: p.id,
        sku: p.sku,
        name: p.name,
        minStock: p.minStock,
        currentStock,
      });
    }
  }
  return result;
}

/**
 * Returns the last N audit log entries with user info and change counts.
 * Used for the Recent Activity widget.
 */
export async function getRecentActivity(
  limit: number = 10
): Promise<RecentActivityItem[]> {
  const logs = await prisma.auditLog.findMany({
    take: limit,
    orderBy: { timestamp: "desc" },
    include: {
      user: { select: { name: true } },
      changes: true,
    },
  });

  return logs.map((log) => ({
    id: log.id,
    timestamp: log.timestamp,
    action: log.action,
    entityType: log.entityType,
    entityLabel: log.entityLabel,
    entityId: log.entityId,
    userName: log.user.name,
    changesCount: log.changes.length,
  }));
}

/**
 * Returns the last N audit log entries for a specific user (for staff dashboard).
 */
export async function getRecentActivityForUser(
  userId: string,
  limit: number = 10
): Promise<RecentActivityItem[]> {
  const logs = await prisma.auditLog.findMany({
    where: { userId },
    take: limit,
    orderBy: { timestamp: "desc" },
    include: {
      user: { select: { name: true } },
      changes: true,
    },
  });

  return logs.map((log) => ({
    id: log.id,
    timestamp: log.timestamp,
    action: log.action,
    entityType: log.entityType,
    entityLabel: log.entityLabel,
    entityId: log.entityId,
    userName: log.user.name,
    changesCount: log.changes.length,
  }));
}

/**
 * Returns aggregate stats for dashboard KPI cards.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(yesterdayStart);
  yesterdayEnd.setHours(23, 59, 59, 999);

  const [
    totalProducts,
    totalCustomers,
    totalWarehouses,
    lowStockCount,
    todayOrders,
    yesterdayOrders,
    outstandingInvoices,
  ] = await Promise.all([
    prisma.product.count({ where: { isActive: true, deletedAt: null } }),
    prisma.customer.count({ where: { isActive: true, deletedAt: null } }),
    prisma.warehouse.count({ where: { isActive: true, deletedAt: null } }),
    prisma.product.count({ where: { minStock: { gt: 0 }, isActive: true, deletedAt: null } }),
    prisma.salesOrder.findMany({
      where: {
        status: { in: ["CONFIRMED", "PARTIALLY_DELIVERED", "FULLY_DELIVERED", "CLOSED"] },
        createdAt: { gte: todayStart },
        deletedAt: null,
      },
      select: { grandTotal: true },
    }),
    prisma.salesOrder.findMany({
      where: {
        status: { in: ["CONFIRMED", "PARTIALLY_DELIVERED", "FULLY_DELIVERED", "CLOSED"] },
        createdAt: { gte: yesterdayStart, lte: yesterdayEnd },
        deletedAt: null,
      },
      select: { grandTotal: true },
    }),
    prisma.arInvoice.findMany({
      where: {
        status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
        deletedAt: null,
      },
      select: { grandTotal: true, amountPaid: true },
    }),
  ]);

  const todaysSales = todayOrders.reduce((sum, o) => sum + o.grandTotal, 0);
  const yesterdaySales = yesterdayOrders.reduce((sum, o) => sum + o.grandTotal, 0);
  const outstandingAR = outstandingInvoices.reduce((sum, i) => sum + (i.grandTotal - i.amountPaid), 0);

  return {
    totalProducts,
    totalCustomers,
    totalWarehouses,
    lowStockCount,
    todaysSales,
    yesterdaySales,
    outstandingAR,
  };
}

/** First and last day of current month (local date) */
function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export async function getMonthlySalesTrend(): Promise<DailySalesItem[]> {
  const { start, end } = getCurrentMonthRange();
  const orders = await prisma.salesOrder.findMany({
    where: {
      status: { in: ["CONFIRMED", "PARTIALLY_DELIVERED", "FULLY_DELIVERED", "CLOSED"] },
      createdAt: { gte: start, lte: end },
      deletedAt: null,
    },
    select: { createdAt: true, grandTotal: true },
  });

  const byDay = new Map<string, number>();
  for (const o of orders) {
    const d = o.createdAt.toISOString().slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + o.grandTotal);
  }

  const out: DailySalesItem[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const d = cur.toISOString().slice(0, 10);
    out.push({ date: d, amount: byDay.get(d) ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export async function getTopProducts(limit = 10): Promise<TopProductItem[]> {
  const { start, end } = getCurrentMonthRange();
  const lines = await prisma.salesOrderLine.findMany({
    where: {
      salesOrder: {
        status: { in: ["CONFIRMED", "PARTIALLY_DELIVERED", "FULLY_DELIVERED", "CLOSED"] },
        createdAt: { gte: start, lte: end },
        deletedAt: null,
      },
    },
    select: {
      productId: true,
      productName: true,
      productSku: true,
      qty: true,
      lineTotal: true,
    },
  });

  const byProduct = new Map<
    string,
    { name: string; sku: string; qty: number; revenue: number }
  >();
  for (const l of lines) {
    const existing = byProduct.get(l.productId);
    if (existing) {
      existing.qty += l.qty;
      existing.revenue += l.lineTotal;
    } else {
      byProduct.set(l.productId, {
        name: l.productName,
        sku: l.productSku,
        qty: l.qty,
        revenue: l.lineTotal,
      });
    }
  }

  return Array.from(byProduct.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export async function getTopCustomers(limit = 10): Promise<TopCustomerItem[]> {
  const { start, end } = getCurrentMonthRange();
  const invoices = await prisma.arInvoice.findMany({
    where: {
      status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] },
      createdAt: { gte: start, lte: end },
      deletedAt: null,
    },
    select: {
      customerId: true,
      grandTotal: true,
      customer: { select: { name: true } },
    },
  });

  const byCustomer = new Map<
    string,
    { name: string; totalAmount: number; invoiceCount: number }
  >();
  for (const inv of invoices) {
    const existing = byCustomer.get(inv.customerId);
    if (existing) {
      existing.totalAmount += inv.grandTotal;
      existing.invoiceCount += 1;
    } else {
      byCustomer.set(inv.customerId, {
        name: inv.customer.name,
        totalAmount: inv.grandTotal,
        invoiceCount: 1,
      });
    }
  }

  return Array.from(byCustomer.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, limit);
}

export async function getPendingApprovals(): Promise<PendingApprovals> {
  const [soCount, expenseCount, leaveCount] = await Promise.all([
    prisma.salesOrder.count({
      where: { status: "WAITING_APPROVAL", deletedAt: null },
    }),
    prisma.expense.count({
      where: { status: "SUBMITTED", deletedAt: null },
    }),
    prisma.leaveRequest.count({
      where: { status: "PENDING" },
    }),
  ]);
  return {
    soCount,
    expenseCount,
    leaveCount,
    total: soCount + expenseCount + leaveCount,
  };
}

export async function getTodaysDeliveries(): Promise<TodayTripItem[]> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  const trips = await prisma.trip.findMany({
    where: {
      tripDate: { gte: todayStart, lte: todayEnd },
      deletedAt: null,
    },
    select: {
      id: true,
      tripNumber: true,
      status: true,
      driver: { select: { name: true } },
      _count: { select: { deliveryOrders: true } },
    },
  });

  return trips.map((t) => ({
    id: t.id,
    tripNumber: t.tripNumber,
    driverName: t.driver.name,
    status: t.status,
    doCount: t._count.deliveryOrders,
  }));
}

export async function getSalespersonPerformance(): Promise<
  SalespersonPerformanceItem[]
> {
  const { start, end } = getCurrentMonthRange();

  const orders = await prisma.salesOrder.findMany({
    where: {
      status: { in: ["CONFIRMED", "PARTIALLY_DELIVERED", "FULLY_DELIVERED", "CLOSED"] },
      createdAt: { gte: start, lte: end },
      deletedAt: null,
    },
    select: {
      createdBy: true,
      grandTotal: true,
      creator: { select: { name: true } },
    },
  });

  const visits = await prisma.customerVisit.findMany({
    where: { checkInAt: { gte: start, lte: end } },
    select: { salespersonId: true, salesperson: { select: { name: true } } },
  });

  const salesByUser = new Map<string, { name: string; sales: number; visits: number }>();
  for (const o of orders) {
    const existing = salesByUser.get(o.createdBy);
    if (existing) {
      existing.sales += o.grandTotal;
    } else {
      salesByUser.set(o.createdBy, {
        name: o.creator.name,
        sales: o.grandTotal,
        visits: 0,
      });
    }
  }
  for (const v of visits) {
    const existing = salesByUser.get(v.salespersonId);
    if (existing) existing.visits += 1;
    else
      salesByUser.set(v.salespersonId, {
        name: v.salesperson.name,
        sales: 0,
        visits: 1,
      });
  }

  return Array.from(salesByUser.entries())
    .map(([userId, v]) => ({
      userId,
      userName: v.name,
      salesAmount: v.sales,
      visitCount: v.visits,
    }))
    .sort((a, b) => b.salesAmount - a.salesAmount)
    .slice(0, 10);
}

/**
 * Returns a simplified AR aging breakdown for the dashboard.
 */
async function getArAgingSummary(): Promise<{ label: string; amount: number }[]> {
  const invoices = await prisma.arInvoice.findMany({
    where: {
      status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
      deletedAt: null,
    },
    select: { grandTotal: true, amountPaid: true, dueDate: true },
  });

  const now = new Date();
  const buckets = [
    { label: "Current", amount: 0 },
    { label: "1-30", amount: 0 },
    { label: "31-60", amount: 0 },
    { label: "61-90", amount: 0 },
    { label: "90+", amount: 0 },
  ];

  for (const inv of invoices) {
    const balance = inv.grandTotal - inv.amountPaid;
    if (balance <= 0) continue;
    const days = Math.floor((now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) buckets[0].amount += balance;
    else if (days <= 30) buckets[1].amount += balance;
    else if (days <= 60) buckets[2].amount += balance;
    else if (days <= 90) buckets[3].amount += balance;
    else buckets[4].amount += balance;
  }

  return buckets;
}

/**
 * Fetches staff/salesperson dashboard data: my sales today, monthly target vs actual,
 * open SOs count, pending commission, and recent activity.
 */
export async function getStaffDashboardData(
  userId: string
): Promise<StaffDashboardData> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);
  const { start: monthStart, end: monthEnd } = getCurrentMonthRange();
  const now = new Date();
  const periodMonth = now.getMonth() + 1;
  const periodYear = now.getFullYear();

  const [
    todayOrders,
    monthOrders,
    openSoCount,
    targetRecord,
    draftCommissions,
    recentActivity,
  ] = await Promise.all([
    prisma.salesOrder.findMany({
      where: {
        createdBy: userId,
        status: { in: ["CONFIRMED", "PARTIALLY_DELIVERED", "FULLY_DELIVERED", "CLOSED"] },
        createdAt: { gte: todayStart, lte: todayEnd },
        deletedAt: null,
      },
      select: { grandTotal: true },
    }),
    prisma.salesOrder.findMany({
      where: {
        createdBy: userId,
        status: { in: ["CONFIRMED", "PARTIALLY_DELIVERED", "FULLY_DELIVERED", "CLOSED"] },
        createdAt: { gte: monthStart, lte: monthEnd },
        deletedAt: null,
      },
      select: { grandTotal: true },
    }),
    prisma.salesOrder.count({
      where: {
        createdBy: userId,
        status: { in: ["DRAFT", "CONFIRMED"] },
        deletedAt: null,
      },
    }),
    prisma.salesTarget.findUnique({
      where: {
        salespersonId_periodMonth_periodYear: {
          salespersonId: userId,
          periodMonth,
          periodYear,
        },
      },
      select: { targetAmount: true },
    }),
    prisma.commission.findMany({
      where: { salespersonId: userId, status: "DRAFT" },
      select: { commissionAmount: true },
    }),
    getRecentActivityForUser(userId, 10),
  ]);

  const mySalesToday = todayOrders.reduce((s, o) => s + o.grandTotal, 0);
  const myMonthlyActual = monthOrders.reduce((s, o) => s + o.grandTotal, 0);
  const myMonthlyTarget = targetRecord?.targetAmount ?? 0;
  const myPendingCommission = draftCommissions.reduce(
    (s, c) => s + c.commissionAmount,
    0
  );

  return {
    mySalesToday,
    myMonthlyTarget,
    myMonthlyActual,
    myOpenSoCount: openSoCount,
    myPendingCommission,
    recentActivity,
  };
}

/**
 * Fetches all dashboard data in a single call for Admin/Manager view.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const [
    stats,
    lowStockProducts,
    recentActivity,
    arAging,
    monthlySalesTrend,
    topProducts,
    topCustomers,
    pendingApprovals,
    todaysDeliveries,
    salespersonPerformance,
  ] = await Promise.all([
    getDashboardStats(),
    getLowStockProducts(),
    getRecentActivity(10),
    getArAgingSummary(),
    getMonthlySalesTrend(),
    getTopProducts(10),
    getTopCustomers(10),
    getPendingApprovals(),
    getTodaysDeliveries(),
    getSalespersonPerformance(),
  ]);

  return {
    stats: {
      ...stats,
      lowStockCount: lowStockProducts.length,
    },
    lowStockProducts,
    recentActivity,
    arAging,
    monthlySalesTrend,
    topProducts,
    topCustomers,
    pendingApprovals,
    todaysDeliveries,
    salespersonPerformance,
  };
}
