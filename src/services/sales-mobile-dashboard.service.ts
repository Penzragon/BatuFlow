import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

export type SalesMobileDashboardKpis = {
  todayVisits: number;
  ordersToday: number;
  todayRevenue: number;
  pendingOrders: number;
  overdueInvoices: number;
};

function isManagerView(role: UserRole): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

function getStartOfToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

function getStartOfTomorrow(startOfToday: Date) {
  const tomorrow = new Date(startOfToday);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

function getStaffOrderScope(userId: string): Prisma.SalesOrderWhereInput {
  return {
    OR: [{ createdBy: userId }, { customer: { salespersonId: userId } }],
  };
}

function getStaffInvoiceScope(userId: string): Prisma.ArInvoiceWhereInput {
  return {
    OR: [
      { deliveryOrder: { salesOrder: { createdBy: userId } } },
      { customer: { salespersonId: userId } },
    ],
  };
}

export class SalesMobileDashboardService {
  static async getKpis(userId: string, role: UserRole): Promise<SalesMobileDashboardKpis> {
    const todayStart = getStartOfToday();
    const tomorrowStart = getStartOfTomorrow(todayStart);
    const managerView = isManagerView(role);

    const orderScope = managerView ? {} : getStaffOrderScope(userId);
    const invoiceScope = managerView ? {} : getStaffInvoiceScope(userId);

    const [todayVisits, ordersToday, todayRevenueAgg, pendingOrders, overdueInvoices] = await Promise.all([
      prisma.customerVisit.count({
        where: managerView
          ? { checkInAt: { gte: todayStart, lt: tomorrowStart } }
          : { salespersonId: userId, checkInAt: { gte: todayStart, lt: tomorrowStart } },
      }),
      prisma.salesOrder.count({
        where: {
          deletedAt: null,
          createdAt: { gte: todayStart, lt: tomorrowStart },
          ...orderScope,
        },
      }),
      prisma.salesOrder.aggregate({
        where: {
          deletedAt: null,
          createdAt: { gte: todayStart, lt: tomorrowStart },
          status: { in: ["CONFIRMED", "PARTIALLY_DELIVERED", "FULLY_DELIVERED", "CLOSED"] },
          ...orderScope,
        },
        _sum: { grandTotal: true },
      }),
      prisma.salesOrder.count({
        where: {
          deletedAt: null,
          status: { in: ["DRAFT", "CONFIRMED", "WAITING_APPROVAL", "PARTIALLY_DELIVERED"] },
          ...orderScope,
        },
      }),
      prisma.arInvoice.count({
        where: {
          deletedAt: null,
          dueDate: { lt: new Date() },
          status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
          ...invoiceScope,
        },
      }),
    ]);

    return {
      todayVisits,
      ordersToday,
      todayRevenue: todayRevenueAgg._sum.grandTotal ?? 0,
      pendingOrders,
      overdueInvoices,
    };
  }
}
