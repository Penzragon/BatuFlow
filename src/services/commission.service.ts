import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { CommissionRule, Commission, CommissionType } from "@prisma/client";

export const createRuleSchema = z.object({
  salespersonId: z.string().uuid(),
  type: z.enum(["PERCENTAGE_SALES", "PERCENTAGE_PROFIT", "TIERED"]),
  rate: z.number().min(0).max(100).optional().nullable(),
  tiers: z
    .array(
      z.object({
        minAmount: z.number().min(0),
        maxAmount: z.number().min(0).optional().nullable(),
        rate: z.number().min(0).max(100),
      })
    )
    .optional()
    .nullable(),
  effectiveDate: z.string(),
  endDate: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateRuleSchema = createRuleSchema.partial();

export const calculateCommissionSchema = z.object({
  salespersonId: z.string().uuid(),
  periodStart: z.string(),
  periodEnd: z.string(),
});

interface CommissionListParams extends PaginationParams {
  salespersonId?: string;
  status?: "DRAFT" | "CONFIRMED";
}

interface TierRow {
  minAmount: number;
  maxAmount?: number | null;
  rate: number;
}

/** Exported for unit tests. */
export function applyTieredRate(tiers: TierRow[], totalSales: number): number {
  let commission = 0;
  let remaining = totalSales;
  for (const tier of tiers.sort((a, b) => a.minAmount - b.minAmount)) {
    const min = tier.minAmount;
    const max = tier.maxAmount ?? Infinity;
    const bracketSize = Math.min(remaining, max - min);
    if (bracketSize > 0) {
      commission += bracketSize * (tier.rate / 100);
      remaining -= bracketSize;
    }
    if (remaining <= 0) break;
  }
  return commission;
}

export class CommissionService {
  static async listRules(salespersonId?: string) {
    const where: { salespersonId?: string } = {};
    if (salespersonId) where.salespersonId = salespersonId;
    const items = await prisma.commissionRule.findMany({
      where,
      include: {
        salesperson: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ effectiveDate: "desc" }],
    });
    return items;
  }

  static async getRule(id: string) {
    const rule = await prisma.commissionRule.findUnique({
      where: { id },
      include: {
        salesperson: { select: { id: true, name: true, email: true } },
      },
    });
    if (!rule) throw new Error("Commission rule not found");
    return rule;
  }

  static async createRule(
    data: z.infer<typeof createRuleSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<CommissionRule> {
    const parsed = createRuleSchema.parse(data);
    if (parsed.type !== "TIERED" && (parsed.rate == null || parsed.rate === undefined)) {
      throw new Error("Rate is required for percentage-based rules");
    }
    if (parsed.type === "TIERED" && (!parsed.tiers || parsed.tiers.length === 0)) {
      throw new Error("Tiers are required for tiered commission rules");
    }

    const rule = await prisma.commissionRule.create({
      data: {
        salespersonId: parsed.salespersonId,
        type: parsed.type as CommissionType,
        rate: parsed.rate ?? null,
        tiers: parsed.tiers ? (parsed.tiers as object) : undefined,
        effectiveDate: new Date(parsed.effectiveDate),
        endDate: parsed.endDate ? new Date(parsed.endDate) : null,
        isActive: parsed.isActive ?? true,
      },
    });

    await AuditService.logCreate({
      userId,
      userRole,
      ipAddress,
      entityType: "CommissionRule",
      entityId: rule.id,
      entityLabel: `Rule for salesperson ${parsed.salespersonId}`,
      data: { type: rule.type, effectiveDate: rule.effectiveDate },
    });

    return rule;
  }

  static async updateRule(
    id: string,
    data: z.infer<typeof updateRuleSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<CommissionRule> {
    const existing = await prisma.commissionRule.findUnique({ where: { id } });
    if (!existing) throw new Error("Commission rule not found");

    const parsed = updateRuleSchema.parse(data);
    const rule = await prisma.commissionRule.update({
      where: { id },
      data: {
        ...(parsed.salespersonId !== undefined && { salespersonId: parsed.salespersonId }),
        ...(parsed.type !== undefined && { type: parsed.type as CommissionType }),
        ...(parsed.rate !== undefined && { rate: parsed.rate }),
        ...(parsed.tiers !== undefined && { tiers: parsed.tiers as object }),
        ...(parsed.effectiveDate !== undefined && { effectiveDate: new Date(parsed.effectiveDate) }),
        ...(parsed.endDate !== undefined && { endDate: parsed.endDate ? new Date(parsed.endDate) : null }),
        ...(parsed.isActive !== undefined && { isActive: parsed.isActive }),
      },
    });

    await AuditService.logUpdate({
      userId,
      userRole,
      ipAddress,
      entityType: "CommissionRule",
      entityId: id,
      entityLabel: `Rule ${id}`,
      oldData: { type: existing.type, rate: existing.rate },
      newData: { type: rule.type, rate: rule.rate },
    });

    return rule;
  }

  static async deleteRule(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<void> {
    const existing = await prisma.commissionRule.findUnique({ where: { id } });
    if (!existing) throw new Error("Commission rule not found");
    await prisma.commissionRule.delete({ where: { id } });
    await AuditService.logDelete({
      userId,
      userRole,
      ipAddress,
      entityType: "CommissionRule",
      entityId: id,
      entityLabel: `Rule ${id}`,
      data: { id, type: existing.type, salespersonId: existing.salespersonId },
    });
  }

  /**
   * Find the active commission rule for a salesperson effective in the given period.
   */
  static async getEffectiveRule(
    salespersonId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<CommissionRule | null> {
    return prisma.commissionRule.findFirst({
      where: {
        salespersonId,
        isActive: true,
        effectiveDate: { lte: periodEnd },
        OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
      },
      orderBy: { effectiveDate: "desc" },
    });
  }

  /**
   * Calculate commission for a salesperson in a period from paid invoices (SO created by that salesperson).
   * Creates Commission and CommissionLine records.
   */
  static async calculateCommission(
    data: z.infer<typeof calculateCommissionSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Commission> {
    const parsed = calculateCommissionSchema.parse(data);
    const periodStart = new Date(parsed.periodStart);
    const periodEnd = new Date(parsed.periodEnd);
    if (periodStart >= periodEnd) throw new Error("Period start must be before period end");

    const rule = await CommissionService.getEffectiveRule(
      parsed.salespersonId,
      periodStart,
      periodEnd
    );
    if (!rule) throw new Error("No active commission rule found for this salesperson in the period");

    const paidInvoices = await prisma.arInvoice.findMany({
      where: {
        status: "PAID",
        issuedAt: { gte: periodStart, lte: periodEnd },
        deletedAt: null,
        deliveryOrder: {
          salesOrder: { createdBy: parsed.salespersonId },
        },
      },
      include: {
        deliveryOrder: {
          include: {
            lines: { include: { product: { select: { capitalCost: true } } } },
            salesOrder: { select: { id: true } },
          },
        },
      },
      orderBy: { issuedAt: "asc" },
    });

    const lines: { invoiceId: string; invoiceAmount: number; profitAmount: number; commissionAmount: number }[] = [];
    let totalSales = 0;
    let totalProfit = 0;

    for (const inv of paidInvoices) {
      const invoiceAmount = inv.grandTotal;
      let cogs = 0;
      for (const line of inv.deliveryOrder.lines) {
        cogs += (line.product?.capitalCost ?? 0) * line.qtyDelivered;
      }
      const profitAmount = invoiceAmount - cogs;
      totalSales += invoiceAmount;
      totalProfit += profitAmount;

      let commissionAmount = 0;
      if (rule.type === "PERCENTAGE_SALES" && rule.rate != null) {
        commissionAmount = invoiceAmount * (rule.rate / 100);
      } else if (rule.type === "PERCENTAGE_PROFIT" && rule.rate != null) {
        commissionAmount = profitAmount * (rule.rate / 100);
      } else if (rule.type === "TIERED" && rule.tiers && Array.isArray(rule.tiers)) {
        const tiers = rule.tiers as unknown as TierRow[];
        const prevCumulative = totalSales - invoiceAmount;
        const commissionUpToThis = applyTieredRate(tiers, prevCumulative);
        const commissionIncludingThis = applyTieredRate(tiers, totalSales);
        commissionAmount = commissionIncludingThis - commissionUpToThis;
      }

      lines.push({
        invoiceId: inv.id,
        invoiceAmount,
        profitAmount,
        commissionAmount,
      });
    }

    const totalCommission =
      rule.type === "TIERED" && rule.tiers && Array.isArray(rule.tiers)
        ? applyTieredRate(rule.tiers as unknown as TierRow[], totalSales)
        : lines.reduce((sum, l) => sum + l.commissionAmount, 0);

    const commission = await prisma.commission.create({
      data: {
        salespersonId: parsed.salespersonId,
        ruleId: rule.id,
        periodStart,
        periodEnd,
        totalSales,
        totalProfit,
        commissionAmount: totalCommission,
        status: "DRAFT",
      },
    });

    await prisma.commissionLine.createMany({
      data: lines.map((l) => ({
        commissionId: commission.id,
        invoiceId: l.invoiceId,
        invoiceAmount: l.invoiceAmount,
        profitAmount: l.profitAmount,
        commissionAmount: l.commissionAmount,
      })),
    });

    await AuditService.logCreate({
      userId,
      userRole,
      ipAddress,
      entityType: "Commission",
      entityId: commission.id,
      entityLabel: `Commission ${periodStart.toISOString().slice(0, 7)}`,
      data: { salespersonId: parsed.salespersonId, totalSales, commissionAmount: totalCommission },
    });

    return commission;
  }

  static async listCommissions(
    params: CommissionListParams
  ): Promise<PaginatedResponse<Commission & { salesperson: { id: string; name: string }; rule: CommissionRule }>> {
    const { page, pageSize, salespersonId, status } = params;
    const where: { salespersonId?: string; status?: "DRAFT" | "CONFIRMED" } = {};
    if (salespersonId) where.salespersonId = salespersonId;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.commission.findMany({
        where,
        include: {
          salesperson: { select: { id: true, name: true } },
          rule: true,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { periodStart: "desc" },
      }),
      prisma.commission.count({ where }),
    ]);

    return {
      items: items as (Commission & { salesperson: { id: string; name: string }; rule: CommissionRule })[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async getCommission(id: string) {
    const commission = await prisma.commission.findUnique({
      where: { id },
      include: {
        salesperson: { select: { id: true, name: true, email: true } },
        rule: true,
        lines: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                grandTotal: true,
                issuedAt: true,
                customer: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!commission) throw new Error("Commission not found");
    return commission;
  }

  static async confirmCommission(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Commission> {
    const commission = await prisma.commission.findUnique({ where: { id } });
    if (!commission) throw new Error("Commission not found");
    if (commission.status === "CONFIRMED") throw new Error("Commission is already confirmed");

    const updated = await prisma.commission.update({
      where: { id },
      data: { status: "CONFIRMED", confirmedBy: userId, confirmedAt: new Date() },
    });

    await AuditService.logUpdate({
      userId,
      userRole,
      ipAddress,
      entityType: "Commission",
      entityId: id,
      entityLabel: `Commission ${commission.periodStart.toISOString().slice(0, 7)}`,
      oldData: { status: commission.status },
      newData: { status: "CONFIRMED" },
    });

    return updated;
  }

  static async exportCommissionsToExcel(commissionIds: string[]): Promise<Buffer> {
    const XLSX = await import("xlsx");
    const commissions = await prisma.commission.findMany({
      where: { id: { in: commissionIds } },
      include: {
        salesperson: { select: { name: true, email: true } },
        rule: true,
        lines: {
          include: {
            invoice: {
              select: {
                invoiceNumber: true,
                grandTotal: true,
                issuedAt: true,
                customer: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { periodStart: "desc" },
    });

    const rows: (string | number)[][] = [
      [
        "Salesperson",
        "Period Start",
        "Period End",
        "Total Sales",
        "Total Profit",
        "Commission Amount",
        "Status",
        "Invoice #",
        "Customer",
        "Invoice Amount",
        "Profit",
        "Line Commission",
      ],
    ];

    for (const c of commissions) {
      const periodStart = c.periodStart.toISOString().slice(0, 10);
      const periodEnd = c.periodEnd.toISOString().slice(0, 10);
      const salespersonName = c.salesperson.name;
      for (let i = 0; i < (c.lines?.length ?? 0); i++) {
        const line = c.lines![i];
        rows.push([
          i === 0 ? salespersonName : "",
          i === 0 ? periodStart : "",
          i === 0 ? periodEnd : "",
          i === 0 ? c.totalSales : "",
          i === 0 ? c.totalProfit : "",
          i === 0 ? c.commissionAmount : "",
          i === 0 ? c.status : "",
          line.invoice?.invoiceNumber ?? "",
          line.invoice?.customer?.name ?? "",
          line.invoiceAmount,
          line.profitAmount,
          line.commissionAmount,
        ]);
      }
      if (!c.lines?.length) {
        rows.push([
          salespersonName,
          periodStart,
          periodEnd,
          c.totalSales,
          c.totalProfit,
          c.commissionAmount,
          c.status,
          "",
          "",
          "",
          "",
          "",
        ]);
      }
    }

    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, sheet, "Commissions");
    return XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
  }
}
