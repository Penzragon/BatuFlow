import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import { StockService } from "./stock.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { StockOpname } from "@prisma/client";

const opnameLineSchema = z.object({
  productId: z.string().uuid(),
});

export const createOpnameSchema = z.object({
  warehouseId: z.string().uuid(),
  notes: z.string().optional(),
  productIds: z.array(z.string().uuid()).min(1),
});

export const updateCountLineSchema = z.object({
  countedQty: z.number().min(0),
  notes: z.string().optional(),
});

interface OpnameListParams extends PaginationParams {
  status?: string;
  warehouseId?: string;
}

export class StockOpnameService {
  static async generateOpnameNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SOP-${year}-`;
    const last = await prisma.stockOpname.findFirst({
      where: { opnameNumber: { startsWith: prefix } },
      orderBy: { opnameNumber: "desc" },
      select: { opnameNumber: true },
    });
    const seq = last ? parseInt(last.opnameNumber.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(5, "0")}`;
  }

  static async createOpname(
    data: z.infer<typeof createOpnameSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<StockOpname> {
    const parsed = createOpnameSchema.parse(data);

    const warehouse = await prisma.warehouse.findUnique({ where: { id: parsed.warehouseId } });
    if (!warehouse) throw new Error("Warehouse not found");

    const opnameNumber = await StockOpnameService.generateOpnameNumber();

    const lineData = [];
    for (const productId of parsed.productIds) {
      const systemQty = await StockService.getCurrentStock(productId, parsed.warehouseId);
      lineData.push({ productId, systemQty });
    }

    const opname = await prisma.stockOpname.create({
      data: {
        opnameNumber,
        warehouseId: parsed.warehouseId,
        status: "DRAFT",
        notes: parsed.notes ?? null,
        createdBy: userId,
        lines: { create: lineData },
      },
      include: { lines: true },
    });

    await AuditService.logCreate({
      userId, userRole, ipAddress,
      entityType: "StockOpname",
      entityId: opname.id,
      entityLabel: opnameNumber,
      data: { opnameNumber, warehouseId: parsed.warehouseId, status: "DRAFT", productCount: parsed.productIds.length },
    });

    return opname;
  }

  static async startCounting(
    id: string,
    countedBy: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<StockOpname> {
    const opname = await prisma.stockOpname.findUnique({ where: { id } });
    if (!opname) throw new Error("Stock opname not found");
    if (opname.status !== "DRAFT") throw new Error("Only draft opnames can be started");

    const updated = await prisma.stockOpname.update({
      where: { id },
      data: { status: "IN_PROGRESS", countedBy },
      include: { lines: true },
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "StockOpname", entityId: id, entityLabel: opname.opnameNumber,
      oldData: { status: "DRAFT" },
      newData: { status: "IN_PROGRESS", countedBy },
    });

    return updated;
  }

  static async updateCountLine(
    opnameId: string,
    lineId: string,
    data: z.infer<typeof updateCountLineSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ) {
    const parsed = updateCountLineSchema.parse(data);

    const opname = await prisma.stockOpname.findUnique({ where: { id: opnameId } });
    if (!opname) throw new Error("Stock opname not found");
    if (!["DRAFT", "IN_PROGRESS"].includes(opname.status)) throw new Error("Opname is not editable");

    const line = await prisma.stockOpnameLine.findUnique({ where: { id: lineId } });
    if (!line || line.stockOpnameId !== opnameId) throw new Error("Opname line not found");

    const variance = parsed.countedQty - line.systemQty;

    const updated = await prisma.stockOpnameLine.update({
      where: { id: lineId },
      data: { countedQty: parsed.countedQty, variance, notes: parsed.notes ?? line.notes },
    });

    return updated;
  }

  static async confirmOpname(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<StockOpname> {
    const opname = await prisma.stockOpname.findUnique({
      where: { id },
      include: { lines: { include: { product: { select: { sku: true } } } } },
    });
    if (!opname) throw new Error("Stock opname not found");
    if (opname.status !== "IN_PROGRESS") throw new Error("Only in-progress opnames can be confirmed");

    const uncountedLines = opname.lines.filter((l) => l.countedQty === null);
    if (uncountedLines.length > 0) {
      throw new Error(`${uncountedLines.length} lines have not been counted yet`);
    }

    await prisma.$transaction(async (tx) => {
      for (const line of opname.lines) {
        const variance = (line.countedQty ?? 0) - line.systemQty;
        if (variance !== 0) {
          await tx.stockLedger.create({
            data: {
              productId: line.productId,
              warehouseId: opname.warehouseId,
              movementType: "OPNAME",
              qty: variance,
              referenceType: "StockOpname",
              referenceId: opname.id,
              notes: `SOP ${opname.opnameNumber} - ${line.product.sku} variance: ${variance}`,
              createdBy: userId,
            },
          });
        }
      }

      await tx.stockOpname.update({
        where: { id },
        data: { status: "CONFIRMED", confirmedBy: userId, confirmedAt: new Date() },
      });
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "StockOpname", entityId: id, entityLabel: opname.opnameNumber,
      oldData: { status: "IN_PROGRESS" },
      newData: { status: "CONFIRMED" },
    });

    return prisma.stockOpname.findUnique({
      where: { id },
      include: { lines: true },
    }) as Promise<StockOpname>;
  }

  static async getOpname(id: string) {
    const opname = await prisma.stockOpname.findUnique({
      where: { id },
      include: {
        lines: { include: { product: { select: { id: true, sku: true, name: true } } } },
        warehouse: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        counter: { select: { id: true, name: true } },
        confirmer: { select: { id: true, name: true } },
      },
    });
    if (!opname) throw new Error("Stock opname not found");
    return opname;
  }

  static async listOpnames(params: OpnameListParams): Promise<PaginatedResponse<StockOpname>> {
    const { page, pageSize, search, status, warehouseId } = params;

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (warehouseId) where.warehouseId = warehouseId;
    if (search) {
      where.OR = [{ opnameNumber: { contains: search, mode: "insensitive" } }];
    }

    const [items, total] = await Promise.all([
      prisma.stockOpname.findMany({
        where,
        include: {
          warehouse: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
          counter: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.stockOpname.count({ where }),
    ]);

    return {
      items: items as unknown as StockOpname[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
