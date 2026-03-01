import { prisma } from "@/lib/db";

export interface CustomerVisitFrequency {
  customerId: string;
  customerName: string;
  visitCount: number;
  lastVisitAt: Date | null;
  daysSinceLastVisit: number | null;
  avgDaysBetweenVisits: number | null;
}

export interface SalespersonVisitSummary {
  salespersonId: string;
  salespersonName: string;
  visitCount: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface SalespersonVisitSeries {
  salespersonId: string;
  salespersonName: string;
  buckets: { label: string; count: number }[];
}

export class VisitAnalyticsService {
  /**
   * Get visit frequency per customer: count, last visit, days since last visit, average days between visits.
   */
  static async getVisitFrequencyByCustomer(params?: {
    customerId?: string;
    salespersonId?: string;
    limit?: number;
  }): Promise<CustomerVisitFrequency[]> {
    const visits = await prisma.customerVisit.findMany({
      where: {
        ...(params?.customerId && { customerId: params.customerId }),
        ...(params?.salespersonId && { salespersonId: params.salespersonId }),
      },
      select: {
        customerId: true,
        customer: { select: { id: true, name: true } },
        checkInAt: true,
      },
      orderBy: { checkInAt: "asc" },
    });

    const byCustomer = new Map<
      string,
      { name: string; dates: Date[] }
    >();
    for (const v of visits) {
      const key = v.customerId;
      if (!byCustomer.has(key)) {
        byCustomer.set(key, { name: v.customer.name, dates: [] });
      }
      byCustomer.get(key)!.dates.push(v.checkInAt);
    }

    const result: CustomerVisitFrequency[] = [];
    for (const [customerId, { name, dates }] of byCustomer.entries()) {
      const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
      const lastVisitAt = sorted.length > 0 ? sorted[sorted.length - 1]! : null;
      const now = new Date();
      const daysSinceLastVisit = lastVisitAt
        ? Math.floor((now.getTime() - lastVisitAt.getTime()) / (24 * 60 * 60 * 1000))
        : null;

      let avgDaysBetweenVisits: number | null = null;
      if (sorted.length >= 2) {
        const gaps: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
          gaps.push(
            Math.floor(
              (sorted[i]!.getTime() - sorted[i - 1]!.getTime()) / (24 * 60 * 60 * 1000)
            )
          );
        }
        avgDaysBetweenVisits = Math.round(
          gaps.reduce((a, b) => a + b, 0) / gaps.length
        );
      }

      result.push({
        customerId,
        customerName: name,
        visitCount: sorted.length,
        lastVisitAt,
        daysSinceLastVisit,
        avgDaysBetweenVisits,
      });
    }

    result.sort((a, b) => b.visitCount - a.visitCount);
    const limit = params?.limit ?? 500;
    return result.slice(0, limit);
  }

  /**
   * Get visit summary per salesperson for a date range (total count in period).
   */
  static async getVisitSummaryBySalesperson(
    dateFrom: string,
    dateTo: string
  ): Promise<SalespersonVisitSummary[]> {
    const start = new Date(dateFrom);
    const end = new Date(dateTo + "T23:59:59.999Z");

    const grouped = await prisma.customerVisit.groupBy({
      by: ["salespersonId"],
      where: {
        checkInAt: { gte: start, lte: end },
      },
      _count: { id: true },
    });

    const userIds = grouped.map((g) => g.salespersonId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const nameById = Object.fromEntries(users.map((u) => [u.id, u.name]));

    return grouped.map((g) => ({
      salespersonId: g.salespersonId,
      salespersonName: nameById[g.salespersonId] ?? "",
      visitCount: g._count.id,
      periodStart: start,
      periodEnd: end,
    }));
  }

  /**
   * Get visit counts by day/week/month per salesperson for charting.
   */
  static async getVisitSeriesBySalesperson(
    dateFrom: string,
    dateTo: string,
    groupBy: "day" | "week" | "month"
  ): Promise<SalespersonVisitSeries[]> {
    const start = new Date(dateFrom);
    const end = new Date(dateTo + "T23:59:59.999Z");

    const visits = await prisma.customerVisit.findMany({
      where: { checkInAt: { gte: start, lte: end } },
      select: { salespersonId: true, checkInAt: true },
    });

    const salespersonIds = [...new Set(visits.map((v) => v.salespersonId))];
    const users = await prisma.user.findMany({
      where: { id: { in: salespersonIds } },
      select: { id: true, name: true },
    });
    const nameById = Object.fromEntries(users.map((u) => [u.id, u.name]));

    const bucketKey = (d: Date): string => {
      if (groupBy === "day") return d.toISOString().slice(0, 10);
      if (groupBy === "week") {
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        return weekStart.toISOString().slice(0, 10);
      }
      return d.toISOString().slice(0, 7);
    };

    const byPerson = new Map<string, Map<string, number>>();
    for (const v of visits) {
      const key = bucketKey(v.checkInAt);
      if (!byPerson.has(v.salespersonId)) {
        byPerson.set(v.salespersonId, new Map());
      }
      const buckets = byPerson.get(v.salespersonId)!;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    const allBuckets = new Set<string>();
    byPerson.forEach((b) => b.forEach((_, k) => allBuckets.add(k)));
    const sortedBuckets = [...allBuckets].sort();

    return salespersonIds.map((id) => ({
      salespersonId: id,
      salespersonName: nameById[id] ?? "",
      buckets: sortedBuckets.map((label) => ({
        label,
        count: byPerson.get(id)?.get(label) ?? 0,
      })),
    }));
  }
}
