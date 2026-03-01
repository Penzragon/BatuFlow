import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import type { FiscalPeriod } from "@prisma/client";

export class FiscalPeriodService {
  static async getOrCreatePeriod(year: number, month: number): Promise<FiscalPeriod> {
    const existing = await prisma.fiscalPeriod.findUnique({
      where: { year_month: { year, month } },
    });
    if (existing) return existing;

    return prisma.fiscalPeriod.create({
      data: { year, month, status: "OPEN" },
    });
  }

  static async closePeriod(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<FiscalPeriod> {
    const period = await prisma.fiscalPeriod.findUnique({ where: { id } });
    if (!period) throw new Error("Fiscal period not found");
    if (period.status === "CLOSED") throw new Error("Period is already closed");

    const draftEntries = await prisma.journalEntry.count({
      where: {
        status: "DRAFT",
        entryDate: {
          gte: new Date(period.year, period.month - 1, 1),
          lte: new Date(period.year, period.month, 0, 23, 59, 59),
        },
      },
    });

    if (draftEntries > 0) {
      throw new Error(`Cannot close period: ${draftEntries} draft journal entries remain`);
    }

    const updated = await prisma.fiscalPeriod.update({
      where: { id },
      data: { status: "CLOSED", closedBy: userId, closedAt: new Date() },
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "FiscalPeriod", entityId: id,
      entityLabel: `${period.year}-${String(period.month).padStart(2, "0")}`,
      oldData: { status: "OPEN" },
      newData: { status: "CLOSED" },
    });

    return updated;
  }

  static async listPeriods(): Promise<FiscalPeriod[]> {
    return prisma.fiscalPeriod.findMany({
      include: { closer: { select: { id: true, name: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
  }

  static async ensurePeriodsExist(year: number): Promise<FiscalPeriod[]> {
    const periods: FiscalPeriod[] = [];
    for (let month = 1; month <= 12; month++) {
      periods.push(await FiscalPeriodService.getOrCreatePeriod(year, month));
    }
    return periods;
  }
}
