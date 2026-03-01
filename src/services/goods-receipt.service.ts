import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import { JournalService } from "./journal.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { GoodsReceipt } from "@prisma/client";

const grLineSchema = z.object({
  productId: z.string().uuid(),
  expectedQty: z.number().min(0),
  receivedQty: z.number().min(0).optional(),
  condition: z.enum(["GOOD", "DAMAGED", "SHORT"]).default("GOOD"),
  notes: z.string().optional(),
  newCost: z.number().min(0).optional(),
});

export const createReceiptSchema = z.object({
  supplierName: z.string().min(1),
  warehouseId: z.string().uuid(),
  receiptDate: z.string(),
  notes: z.string().optional(),
  lines: z.array(grLineSchema).min(1),
});

interface GRListParams extends PaginationParams {
  status?: string;
  warehouseId?: string;
}

export class GoodsReceiptService {
  static async generateReceiptNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `GR-${year}-`;
    const last = await prisma.goodsReceipt.findFirst({
      where: { receiptNumber: { startsWith: prefix } },
      orderBy: { receiptNumber: "desc" },
      select: { receiptNumber: true },
    });
    const seq = last ? parseInt(last.receiptNumber.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(5, "0")}`;
  }

  static async createReceipt(
    data: z.infer<typeof createReceiptSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<GoodsReceipt> {
    const parsed = createReceiptSchema.parse(data);

    const receiptNumber = await GoodsReceiptService.generateReceiptNumber();

    const receipt = await prisma.goodsReceipt.create({
      data: {
        receiptNumber,
        supplierName: parsed.supplierName,
        warehouseId: parsed.warehouseId,
        receiptDate: new Date(parsed.receiptDate),
        status: "DRAFT",
        notes: parsed.notes ?? null,
        createdBy: userId,
        lines: {
          create: parsed.lines.map((l) => ({
            productId: l.productId,
            expectedQty: l.expectedQty,
            receivedQty: l.receivedQty ?? 0,
            condition: l.condition,
            notes: l.notes ?? null,
            newCost: l.newCost ?? null,
          })),
        },
      },
      include: { lines: true },
    });

    await AuditService.logCreate({
      userId, userRole, ipAddress,
      entityType: "GoodsReceipt",
      entityId: receipt.id,
      entityLabel: receiptNumber,
      data: { receiptNumber, supplierName: parsed.supplierName, status: "DRAFT" },
    });

    return receipt;
  }

  static async verifyReceipt(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<GoodsReceipt> {
    const receipt = await prisma.goodsReceipt.findUnique({ where: { id } });
    if (!receipt) throw new Error("Goods receipt not found");
    if (receipt.status !== "DRAFT") throw new Error("Only draft receipts can be verified");

    const updated = await prisma.goodsReceipt.update({
      where: { id },
      data: { status: "VERIFIED", verifiedBy: userId, verifiedAt: new Date() },
      include: { lines: true },
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "GoodsReceipt", entityId: id, entityLabel: receipt.receiptNumber,
      oldData: { status: "DRAFT" },
      newData: { status: "VERIFIED" },
    });

    return updated;
  }

  static async confirmReceipt(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<GoodsReceipt> {
    const receipt = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: { lines: { include: { product: true } } },
    });
    if (!receipt) throw new Error("Goods receipt not found");
    if (receipt.status !== "VERIFIED") throw new Error("Only verified receipts can be confirmed");

    await prisma.$transaction(async (tx) => {
      for (const line of receipt.lines) {
        if (line.receivedQty > 0 && line.condition === "GOOD") {
          await tx.stockLedger.create({
            data: {
              productId: line.productId,
              warehouseId: receipt.warehouseId,
              movementType: "STOCK_IN",
              qty: line.receivedQty,
              referenceType: "GoodsReceipt",
              referenceId: receipt.id,
              notes: `GR ${receipt.receiptNumber}`,
              createdBy: userId,
            },
          });
        }

        if (line.newCost != null && line.newCost > 0) {
          const oldCost = line.product.capitalCost;
          await tx.product.update({
            where: { id: line.productId },
            data: { capitalCost: line.newCost },
          });
          await tx.productCapitalHistory.create({
            data: {
              productId: line.productId,
              oldCost,
              newCost: line.newCost,
              changedBy: userId,
              source: "goods_receipt",
              notes: `From GR ${receipt.receiptNumber}`,
            },
          });
        }
      }

      await tx.goodsReceipt.update({
        where: { id },
        data: { status: "CONFIRMED", confirmedBy: userId, confirmedAt: new Date() },
      });
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "GoodsReceipt", entityId: id, entityLabel: receipt.receiptNumber,
      oldData: { status: "VERIFIED" },
      newData: { status: "CONFIRMED" },
    });

    try {
      let totalValue = 0;
      for (const line of receipt.lines) {
        if (line.receivedQty > 0 && line.condition === "GOOD") {
          const cost = line.newCost ?? line.product.capitalCost;
          totalValue += line.receivedQty * cost;
        }
      }
      if (totalValue > 0) {
        await JournalService.autoPostFromGoodsReceipt(
          receipt.id,
          receipt.receiptNumber,
          totalValue,
          userId, userRole, ipAddress
        );
      }
    } catch {
      // Auto-posting is best-effort
    }

    return prisma.goodsReceipt.findUnique({
      where: { id },
      include: { lines: true },
    }) as Promise<GoodsReceipt>;
  }

  static async getReceipt(id: string) {
    const receipt = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        lines: { include: { product: { select: { id: true, sku: true, name: true } } } },
        warehouse: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        verifier: { select: { id: true, name: true } },
        confirmer: { select: { id: true, name: true } },
      },
    });
    if (!receipt) throw new Error("Goods receipt not found");
    return receipt;
  }

  static async listReceipts(params: GRListParams): Promise<PaginatedResponse<GoodsReceipt>> {
    const { page, pageSize, search, status, warehouseId } = params;

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (warehouseId) where.warehouseId = warehouseId;
    if (search) {
      where.OR = [
        { receiptNumber: { contains: search, mode: "insensitive" } },
        { supplierName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.goodsReceipt.findMany({
        where,
        include: {
          warehouse: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.goodsReceipt.count({ where }),
    ]);

    return {
      items: items as unknown as GoodsReceipt[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
