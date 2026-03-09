import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import { createNotification } from "./notification.service";
import { PPN_RATE, SO_DISCOUNT_APPROVAL_THRESHOLD } from "@/lib/constants";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { SalesOrder, SOStatus } from "@prisma/client";

const soLineSchema = z.object({
  productId: z.string().uuid(),
  qty: z.number().min(0.01),
  unitPrice: z.number().min(0).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  priceOverride: z.boolean().default(false),
  uom: z.string().default("pcs"),
});

export const createSOSchema = z.object({
  customerId: z.string().uuid(),
  visitId: z.string().uuid().optional(),
  lines: z.array(soLineSchema).min(1),
  notes: z.string().optional(),
  includePpn: z.boolean().default(true),
});

export const updateSOSchema = z.object({
  lines: z.array(soLineSchema).min(1).optional(),
  notes: z.string().optional(),
  includePpn: z.boolean().optional(),
});

interface SOListParams extends PaginationParams {
  status?: SOStatus;
  customerId?: string;
  createdBy?: string;
  dateFrom?: string;
  dateTo?: string;
  viewer?: { id: string; role: string };
}

/**
 * Manages the full Sales Order lifecycle: creation with auto-pricing
 * from product price tiers, confirmation with approval workflow,
 * and status tracking through delivery and closure.
 */
export class SalesOrderService {
  private static applyStaffScope(where: Record<string, unknown>, viewer?: { id: string; role: string }) {
    if (viewer?.role !== "STAFF") return;
    where.OR = [
      { createdBy: viewer.id },
      { customer: { salespersonId: viewer.id } },
    ];
  }

  private static assertStaffCanAccessSO(
    salesOrder: { createdBy: string; customer?: { salespersonId: string | null } | null },
    viewer?: { id: string; role: string }
  ) {
    if (viewer?.role !== "STAFF") return;

    const ownedByStaff =
      salesOrder.createdBy === viewer.id || salesOrder.customer?.salespersonId === viewer.id;
    if (!ownedByStaff) {
      throw new Error("Sales order not found");
    }
  }
  /**
   * Auto-generates the next sequential SO number formatted as SO-YYYY-NNNNN.
   */
  static async generateSONumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SO-${year}-`;
    const last = await prisma.salesOrder.findFirst({
      where: { soNumber: { startsWith: prefix } },
      orderBy: { soNumber: "desc" },
      select: { soNumber: true },
    });
    const seq = last ? parseInt(last.soNumber.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(5, "0")}`;
  }

  /**
   * Determines the price tier for a product at a given quantity.
   * Returns the tier unit price, or the product's default sell price if no tier matches.
   */
  static async getApplicablePrice(
    productId: string,
    qty: number
  ): Promise<{ unitPrice: number; tierApplied: string | null }> {
    const tiers = await prisma.productPriceTier.findMany({
      where: { productId },
      orderBy: { minQty: "asc" },
    });

    for (const tier of tiers) {
      if (qty >= tier.minQty && (tier.maxQty === null || qty <= tier.maxQty)) {
        return { unitPrice: tier.unitPrice, tierApplied: `${tier.minQty}-${tier.maxQty ?? "∞"}` };
      }
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { sellPrice: true },
    });
    return { unitPrice: product?.sellPrice ?? 0, tierApplied: null };
  }

  /**
   * Creates a new Sales Order in Draft status. Auto-applies price tiers
   * per line, calculates discounts, subtotals, PPN, and grand total.
   * Flags the SO for manager approval if any line has a discount above
   * the threshold or a manual price override.
   */
  static async createSO(
    data: z.infer<typeof createSOSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<SalesOrder> {
    const parsed = createSOSchema.parse(data);
    const soNumber = await SalesOrderService.generateSONumber();

    const customer = await prisma.customer.findUnique({
      where: { id: parsed.customerId },
      select: { id: true, salespersonId: true, deletedAt: true, isActive: true },
    });
    if (!customer || customer.deletedAt || !customer.isActive) {
      throw new Error("Customer not found");
    }

    if (userRole === "STAFF" && customer.salespersonId !== userId) {
      throw new Error("Customer not found");
    }

    if (parsed.visitId) {
      const visit = await prisma.customerVisit.findUnique({
        where: { id: parsed.visitId },
        select: { customerId: true, salespersonId: true },
      });
      if (!visit || visit.customerId !== parsed.customerId || visit.salespersonId !== userId) {
        throw new Error("Visit not found");
      }
    }

    let needsApproval = false;
    let approvalReason = "";
    const lineData = [];

    for (const line of parsed.lines) {
      const product = await prisma.product.findUnique({
        where: { id: line.productId },
        select: { id: true, name: true, sku: true, sellPrice: true },
      });
      if (!product) throw new Error(`Product ${line.productId} not found`);

      let unitPrice: number;
      let tierApplied: string | null = null;

      if (line.priceOverride && line.unitPrice != null) {
        unitPrice = line.unitPrice;
        needsApproval = true;
        approvalReason = approvalReason
          ? `${approvalReason}; Price override on ${product.sku}`
          : `Price override on ${product.sku}`;
      } else {
        const pricing = await SalesOrderService.getApplicablePrice(product.id, line.qty);
        unitPrice = pricing.unitPrice;
        tierApplied = pricing.tierApplied;
      }

      const lineSubtotal = unitPrice * line.qty;
      let discountAmount: number;
      let discountPercent: number;
      if (line.discountAmount != null && Number.isFinite(line.discountAmount) && line.discountAmount > 0) {
        discountAmount = Math.min(line.discountAmount, lineSubtotal);
        discountPercent = lineSubtotal > 0 ? (discountAmount / lineSubtotal) * 100 : 0;
      } else {
        const pct = Number(line.discountPercent) || 0;
        discountPercent = Math.min(pct, 100);
        discountAmount = (lineSubtotal * discountPercent) / 100;
      }
      const lineTotal = lineSubtotal - discountAmount;

      if (discountPercent > SO_DISCOUNT_APPROVAL_THRESHOLD) {
        needsApproval = true;
        const reason = `Discount ${discountPercent.toFixed(1)}% on ${product.sku}`;
        approvalReason = approvalReason ? `${approvalReason}; ${reason}` : reason;
      }

      lineData.push({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        uom: line.uom,
        qty: line.qty,
        unitPrice,
        tierApplied,
        discountPercent,
        discountAmount,
        priceOverride: line.priceOverride,
        lineTotal,
      });
    }

    const subtotal = lineData.reduce((sum, l) => sum + l.lineTotal, 0);
    const discountTotal = lineData.reduce((sum, l) => sum + l.discountAmount, 0);
    const includePpn = parsed.includePpn !== false;
    const ppnRate = includePpn ? PPN_RATE : 0;
    const ppnAmount = subtotal * ppnRate;
    const grandTotal = subtotal + ppnAmount;

    const so = await prisma.salesOrder.create({
      data: {
        soNumber,
        customerId: parsed.customerId,
        visitId: parsed.visitId ?? null,
        status: "DRAFT",
        subtotal,
        discountTotal,
        ppnRate,
        ppnAmount,
        grandTotal,
        notes: parsed.notes ?? null,
        needsApproval,
        approvalReason: approvalReason || null,
        createdBy: userId,
        lines: { create: lineData },
      },
      include: { lines: true },
    });

    await AuditService.logCreate({
      userId,
      userRole,
      ipAddress,
      entityType: "SalesOrder",
      entityId: so.id,
      entityLabel: so.soNumber,
      data: { soNumber: so.soNumber, customerId: so.customerId, grandTotal: so.grandTotal, status: so.status },
    });

    return so;
  }

  /**
   * Updates a Draft SO's lines and notes. Recalculates all totals.
   */
  static async updateSO(
    id: string,
    data: z.infer<typeof updateSOSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<SalesOrder> {
    const existing = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        lines: true,
        customer: { select: { salespersonId: true } },
      },
    });
    if (!existing) throw new Error("Sales order not found");
    SalesOrderService.assertStaffCanAccessSO(existing, { id: userId, role: userRole });
    if (existing.status !== "DRAFT") throw new Error("Only draft orders can be updated");

    const parsed = updateSOSchema.parse(data);

    if (parsed.lines) {
      await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: id } });

      let needsApproval = false;
      let approvalReason = "";
      const lineData = [];

      for (const line of parsed.lines) {
        const product = await prisma.product.findUnique({
          where: { id: line.productId },
          select: { id: true, name: true, sku: true, sellPrice: true },
        });
        if (!product) throw new Error(`Product ${line.productId} not found`);

        let unitPrice: number;
        let tierApplied: string | null = null;

        if (line.priceOverride && line.unitPrice != null) {
          unitPrice = line.unitPrice;
          needsApproval = true;
          approvalReason = approvalReason
            ? `${approvalReason}; Price override on ${product.sku}`
            : `Price override on ${product.sku}`;
        } else {
          const pricing = await SalesOrderService.getApplicablePrice(product.id, line.qty);
          unitPrice = pricing.unitPrice;
          tierApplied = pricing.tierApplied;
        }

        const lineSubtotal = unitPrice * line.qty;
        let discountAmount: number;
        let discountPercent: number;
        if (line.discountAmount != null && Number.isFinite(line.discountAmount) && line.discountAmount > 0) {
          discountAmount = Math.min(line.discountAmount, lineSubtotal);
          discountPercent = lineSubtotal > 0 ? (discountAmount / lineSubtotal) * 100 : 0;
        } else {
          const pct = Number(line.discountPercent) || 0;
          discountPercent = Math.min(pct, 100);
          discountAmount = (lineSubtotal * discountPercent) / 100;
        }
        const lineTotal = lineSubtotal - discountAmount;

        if (discountPercent > SO_DISCOUNT_APPROVAL_THRESHOLD) {
          needsApproval = true;
          const reason = `Discount ${discountPercent.toFixed(1)}% on ${product.sku}`;
          approvalReason = approvalReason ? `${approvalReason}; ${reason}` : reason;
        }

        lineData.push({
          salesOrderId: id,
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          uom: line.uom,
          qty: line.qty,
          unitPrice,
          tierApplied,
          discountPercent,
          discountAmount,
          priceOverride: line.priceOverride,
          lineTotal,
        });
      }

      const subtotal = lineData.reduce((sum, l) => sum + l.lineTotal, 0);
      const discountTotal = lineData.reduce((sum, l) => sum + l.discountAmount, 0);
      const includePpn = parsed.includePpn ?? (existing.ppnRate > 0);
      const ppnRate = includePpn ? PPN_RATE : 0;
      const ppnAmount = subtotal * ppnRate;
      const grandTotal = subtotal + ppnAmount;

      await prisma.salesOrderLine.createMany({ data: lineData });
      const so = await prisma.salesOrder.update({
        where: { id },
        data: {
          subtotal,
          discountTotal,
          ppnRate,
          ppnAmount,
          grandTotal,
          needsApproval,
          approvalReason: approvalReason || null,
          notes: parsed.notes ?? existing.notes,
        },
        include: { lines: true },
      });

      await AuditService.logUpdate({
        userId, userRole, ipAddress,
        entityType: "SalesOrder", entityId: so.id, entityLabel: so.soNumber,
        oldData: { grandTotal: existing.grandTotal, notes: existing.notes },
        newData: { grandTotal: so.grandTotal, notes: so.notes },
      });

      return so;
    }

    const so = await prisma.salesOrder.update({
      where: { id },
      data: { notes: parsed.notes ?? existing.notes },
      include: { lines: true },
    });
    return so;
  }

  /**
   * Confirms a Draft SO. If it needs approval (discount/override flags),
   * moves to WAITING_APPROVAL; otherwise directly to CONFIRMED.
   */
  static async confirmSO(
    id: string, userId: string, userRole: string, ipAddress?: string
  ): Promise<SalesOrder> {
    const so = await prisma.salesOrder.findUnique({
      where: { id },
      include: { customer: { select: { salespersonId: true } } },
    });
    if (!so) throw new Error("Sales order not found");
    SalesOrderService.assertStaffCanAccessSO(so, { id: userId, role: userRole });
    if (so.status !== "DRAFT") throw new Error("Only draft orders can be confirmed");

    const newStatus: SOStatus = so.needsApproval ? "WAITING_APPROVAL" : "CONFIRMED";
    const updated = await prisma.salesOrder.update({
      where: { id },
      data: { status: newStatus },
      include: { lines: true },
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "SalesOrder", entityId: so.id, entityLabel: so.soNumber,
      oldData: { status: so.status },
      newData: { status: newStatus },
    });

    if (newStatus === "WAITING_APPROVAL") {
      const managers = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true, deletedAt: null },
        select: { id: true },
      });
      for (const mgr of managers) {
        await createNotification({
          userId: mgr.id,
          title: "SO Approval Required",
          message: `Sales Order ${so.soNumber} needs your approval. Reason: ${so.approvalReason ?? "N/A"}`,
          entityType: "SalesOrder",
          entityId: so.id,
        });
      }
    }

    return updated;
  }

  /**
   * Manager approves an SO that was waiting for approval.
   */
  static async approveSO(
    id: string, managerId: string, userRole: string, ipAddress?: string
  ): Promise<SalesOrder> {
    const so = await prisma.salesOrder.findUnique({ where: { id } });
    if (!so) throw new Error("Sales order not found");
    if (so.status !== "WAITING_APPROVAL") throw new Error("Order is not waiting for approval");

    const updated = await prisma.salesOrder.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        approvedBy: managerId,
        approvedAt: new Date(),
      },
      include: { lines: true },
    });

    await AuditService.logApproval({
      userId: managerId, userRole, ipAddress,
      entityType: "SalesOrder", entityId: so.id, entityLabel: so.soNumber,
      action: "APPROVE",
    });

    return updated;
  }

  /**
   * Manager rejects an SO. Moves back to DRAFT for revision.
   */
  static async rejectSO(
    id: string, managerId: string, reason: string,
    userRole: string, ipAddress?: string
  ): Promise<SalesOrder> {
    const so = await prisma.salesOrder.findUnique({ where: { id } });
    if (!so) throw new Error("Sales order not found");
    if (so.status !== "WAITING_APPROVAL") throw new Error("Order is not waiting for approval");

    const updated = await prisma.salesOrder.update({
      where: { id },
      data: {
        status: "DRAFT",
        rejectedBy: managerId,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
      include: { lines: true },
    });

    await AuditService.logApproval({
      userId: managerId, userRole, ipAddress,
      entityType: "SalesOrder", entityId: so.id, entityLabel: so.soNumber,
      action: "REJECT",
      metadata: { reason },
    });

    return updated;
  }

  /**
   * Cancels a Draft or Confirmed SO.
   */
  static async cancelSO(
    id: string, userId: string, userRole: string, ipAddress?: string
  ): Promise<SalesOrder> {
    const so = await prisma.salesOrder.findUnique({
      where: { id },
      include: { customer: { select: { salespersonId: true } } },
    });
    if (!so) throw new Error("Sales order not found");
    SalesOrderService.assertStaffCanAccessSO(so, { id: userId, role: userRole });
    if (!["DRAFT", "CONFIRMED", "WAITING_APPROVAL"].includes(so.status)) {
      throw new Error("Cannot cancel an order that is already delivered or closed");
    }

    const updated = await prisma.salesOrder.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: { lines: true },
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "SalesOrder", entityId: so.id, entityLabel: so.soNumber,
      oldData: { status: so.status },
      newData: { status: "CANCELLED" },
    });

    return updated;
  }

  /**
   * Gets a single SO with lines, customer, visit info.
   */
  static async getSO(id: string, viewer?: { id: string; role: string }) {
    const so = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        lines: { include: { product: { select: { id: true, name: true, sku: true, imageUrl: true } } } },
        customer: { select: { id: true, name: true, email: true, phone: true, paymentTermsDays: true, salespersonId: true } },
        visit: true,
        creator: { select: { id: true, name: true } },
        deliveryOrders: {
          select: { id: true, doNumber: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!so) throw new Error("Sales order not found");

    SalesOrderService.assertStaffCanAccessSO(so, viewer);

    return so;
  }

  /**
   * Returns a paginated list of Sales Orders with filters.
   */
  static async listSOs(params: SOListParams): Promise<PaginatedResponse<SalesOrder>> {
    const { page, pageSize, search, status, customerId, createdBy, dateFrom, dateTo, viewer } = params;

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (createdBy) where.createdBy = createdBy;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo + "T23:59:59Z") } : {}),
      };
    }
    if (search) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { soNumber: { contains: search, mode: "insensitive" } },
            { customer: { name: { contains: search, mode: "insensitive" } } },
          ],
        },
      ];
    }

    SalesOrderService.applyStaffScope(where, viewer);

    const [items, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
          _count: { select: { lines: true, deliveryOrders: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.salesOrder.count({ where }),
    ]);

    return {
      items: items as unknown as SalesOrder[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
