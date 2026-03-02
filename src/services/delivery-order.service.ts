import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import { PickListService } from "./pick-list.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { DeliveryOrder } from "@prisma/client";

const doLineSchema = z.object({
  productId: z.string().uuid(),
  qtyDelivered: z.number().min(0.01),
});

export const createDOSchema = z.object({
  salesOrderId: z.string().uuid(),
  lines: z.array(doLineSchema).min(1),
  notes: z.string().optional(),
});

interface DOListParams extends PaginationParams {
  salesOrderId?: string;
  status?: string;
}

/**
 * Manages Delivery Orders: creation from confirmed Sales Orders,
 * confirmation with stock ledger reduction, and parent SO status updates.
 */
export class DeliveryOrderService {
  /**
   * Generates the next sequential DO number formatted as DO-YYYY-NNNNN.
   */
  static async generateDONumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DO-${year}-`;
    const last = await prisma.deliveryOrder.findFirst({
      where: { doNumber: { startsWith: prefix } },
      orderBy: { doNumber: "desc" },
      select: { doNumber: true },
    });
    const seq = last ? parseInt(last.doNumber.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(5, "0")}`;
  }

  /**
   * Creates a Delivery Order from a confirmed Sales Order.
   * Validates that delivery quantities don't exceed remaining (ordered - already delivered).
   */
  static async createDO(
    data: z.infer<typeof createDOSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<DeliveryOrder> {
    const parsed = createDOSchema.parse(data);

    const so = await prisma.salesOrder.findUnique({
      where: { id: parsed.salesOrderId },
      include: {
        lines: true,
        deliveryOrders: {
          where: { deletedAt: null },
          include: { lines: true },
        },
      },
    });
    if (!so) throw new Error("Sales order not found");
    if (!["CONFIRMED", "PARTIALLY_DELIVERED"].includes(so.status)) {
      throw new Error("Sales order must be confirmed before creating a delivery order");
    }

    const deliveredQtyMap = new Map<string, number>();
    for (const existingDO of so.deliveryOrders) {
      for (const line of existingDO.lines) {
        deliveredQtyMap.set(
          line.productId,
          (deliveredQtyMap.get(line.productId) ?? 0) + line.qtyDelivered
        );
      }
    }

    const lineData = [];
    for (const line of parsed.lines) {
      const soLine = so.lines.find((l) => l.productId === line.productId);
      if (!soLine) throw new Error(`Product ${line.productId} is not in this sales order`);

      const alreadyDelivered = deliveredQtyMap.get(line.productId) ?? 0;
      const remaining = soLine.qty - alreadyDelivered;
      if (line.qtyDelivered > remaining) {
        throw new Error(
          `Cannot deliver ${line.qtyDelivered} of ${soLine.productSku}. Remaining: ${remaining}`
        );
      }

      lineData.push({
        productId: soLine.productId,
        productName: soLine.productName,
        productSku: soLine.productSku,
        uom: soLine.uom,
        qtyOrdered: soLine.qty,
        qtyDelivered: line.qtyDelivered,
      });
    }

    const doNumber = await DeliveryOrderService.generateDONumber();
    const deliveryOrder = await prisma.deliveryOrder.create({
      data: {
        doNumber,
        salesOrderId: parsed.salesOrderId,
        status: "DRAFT",
        notes: parsed.notes ?? null,
        createdBy: userId,
        lines: { create: lineData },
      },
      include: { lines: true },
    });

    await AuditService.logCreate({
      userId, userRole, ipAddress,
      entityType: "DeliveryOrder", entityId: deliveryOrder.id, entityLabel: doNumber,
      data: { doNumber, salesOrderId: so.soNumber, status: "DRAFT" },
    });

    return deliveryOrder;
  }

  /**
   * Confirms a Delivery Order. Creates STOCK_OUT entries in the stock ledger
   * for each line and updates the parent SO status.
   */
  static async confirmDO(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<DeliveryOrder> {
    const deliveryOrder = await prisma.deliveryOrder.findUnique({
      where: { id },
      include: { lines: true, salesOrder: { include: { lines: true } } },
    });
    if (!deliveryOrder) throw new Error("Delivery order not found");
    if (deliveryOrder.status !== "DRAFT") throw new Error("Only draft delivery orders can be confirmed");

    const defaultWarehouse = await prisma.warehouse.findFirst({
      where: { isDefault: true, deletedAt: null },
      select: { id: true },
    });
    if (!defaultWarehouse) throw new Error("No default warehouse configured");

    await prisma.$transaction(async (tx) => {
      for (const line of deliveryOrder.lines) {
        await tx.stockLedger.create({
          data: {
            productId: line.productId,
            warehouseId: defaultWarehouse.id,
            movementType: "STOCK_OUT",
            qty: -line.qtyDelivered,
            referenceType: "DeliveryOrder",
            referenceId: deliveryOrder.id,
            notes: `DO ${deliveryOrder.doNumber}`,
            createdBy: userId,
          },
        });
      }

      await tx.deliveryOrder.update({
        where: { id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
    });

    await DeliveryOrderService.updateSODeliveryStatus(deliveryOrder.salesOrderId);

    try {
      await PickListService.createPickList(id, userId, userRole, ipAddress);
    } catch {
      // Pick list creation is best-effort; log but don't fail the DO confirmation
    }

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "DeliveryOrder", entityId: id, entityLabel: deliveryOrder.doNumber,
      oldData: { status: "DRAFT" },
      newData: { status: "CONFIRMED" },
    });

    return prisma.deliveryOrder.findUnique({
      where: { id },
      include: { lines: true },
    }) as Promise<DeliveryOrder>;
  }

  /**
   * Recalculates and updates the parent SO delivery status based on
   * total quantities delivered across all DOs that have actually been
   * delivered to the customer (deliveryStatus = DELIVERED).
   */
  static async updateSODeliveryStatus(salesOrderId: string): Promise<void> {
    const so = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        lines: true,
        deliveryOrders: {
          where: { status: "CONFIRMED", deliveryStatus: "DELIVERED", deletedAt: null },
          include: { lines: true },
        },
      },
    });
    if (!so) return;

    const deliveredQtyMap = new Map<string, number>();
    for (const dOrder of so.deliveryOrders) {
      for (const line of dOrder.lines) {
        deliveredQtyMap.set(
          line.productId,
          (deliveredQtyMap.get(line.productId) ?? 0) + line.qtyDelivered
        );
      }
    }

    const allFullyDelivered = so.lines.every((soLine) => {
      const delivered = deliveredQtyMap.get(soLine.productId) ?? 0;
      return delivered >= soLine.qty;
    });

    const anyDelivered = Array.from(deliveredQtyMap.values()).some((q) => q > 0);

    let newStatus = so.status;
    if (allFullyDelivered) {
      newStatus = "FULLY_DELIVERED";
    } else if (anyDelivered) {
      newStatus = "PARTIALLY_DELIVERED";
    }

    if (newStatus !== so.status) {
      await prisma.salesOrder.update({
        where: { id: salesOrderId },
        data: { status: newStatus },
      });
    }
  }

  /**
   * Gets a single DO with all related data.
   */
  static async getDO(id: string) {
    const deliveryOrder = await prisma.deliveryOrder.findUnique({
      where: { id },
      include: {
        lines: { include: { product: { select: { id: true, name: true, sku: true } } } },
        salesOrder: {
          select: { id: true, soNumber: true, customerId: true, customer: { select: { id: true, name: true } } },
        },
        creator: { select: { id: true, name: true } },
        invoices: {
          select: { id: true, invoiceNumber: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!deliveryOrder) throw new Error("Delivery order not found");
    return deliveryOrder;
  }

  /**
   * Returns paginated list of Delivery Orders with optional filters.
   */
  static async listDOs(params: DOListParams): Promise<PaginatedResponse<DeliveryOrder>> {
    const { page, pageSize, search, salesOrderId, status } = params;

    const where: Record<string, unknown> = { deletedAt: null };
    if (salesOrderId) where.salesOrderId = salesOrderId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { doNumber: { contains: search, mode: "insensitive" } },
        { salesOrder: { soNumber: { contains: search, mode: "insensitive" } } },
        { salesOrder: { customer: { name: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.deliveryOrder.findMany({
        where,
        include: {
          salesOrder: {
            select: { id: true, soNumber: true, customer: { select: { id: true, name: true } } },
          },
          creator: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.deliveryOrder.count({ where }),
    ]);

    return {
      items: items as unknown as DeliveryOrder[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
