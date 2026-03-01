import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import type { PaginatedResponse, PaginationParams } from "@/types";

export const manualAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  qty: z.number(),
  notes: z.string().min(1, "Notes are required for adjustments"),
});

interface StockOnHandParams extends PaginationParams {
  warehouseId?: string;
  category?: string;
  lowStockOnly?: boolean;
}

interface StockMovementParams extends PaginationParams {
  productId?: string;
  warehouseId?: string;
  movementType?: string;
  dateFrom?: string;
  dateTo?: string;
}

export class StockService {
  static async getCurrentStock(productId: string, warehouseId?: string) {
    const where: Record<string, unknown> = { productId };
    if (warehouseId) where.warehouseId = warehouseId;

    const result = await prisma.stockLedger.aggregate({
      where,
      _sum: { qty: true },
    });

    return result._sum.qty ?? 0;
  }

  static async getStockOnHand(params: StockOnHandParams): Promise<PaginatedResponse<unknown>> {
    const { page, pageSize, search, warehouseId, category, lowStockOnly } = params;

    const productWhere: Record<string, unknown> = { deletedAt: null };
    if (search) {
      productWhere.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ];
    }
    if (category) productWhere.category = category;

    const products = await prisma.product.findMany({
      where: productWhere,
      select: {
        id: true,
        sku: true,
        name: true,
        category: true,
        baseUom: true,
        minStock: true,
        maxStock: true,
        capitalCost: true,
        sellPrice: true,
      },
      orderBy: { name: "asc" },
    });

    const ledgerWhere: Record<string, unknown> = {};
    if (warehouseId) ledgerWhere.warehouseId = warehouseId;

    const stockAgg = await prisma.stockLedger.groupBy({
      by: ["productId"],
      where: ledgerWhere,
      _sum: { qty: true },
    });

    const stockMap = new Map<string, number>();
    for (const row of stockAgg) {
      stockMap.set(row.productId, row._sum.qty ?? 0);
    }

    let items = products.map((p) => {
      const currentQty = stockMap.get(p.id) ?? 0;
      let stockStatus: "normal" | "low" | "overstock" | "out_of_stock" = "normal";
      if (currentQty <= 0) stockStatus = "out_of_stock";
      else if (currentQty < p.minStock) stockStatus = "low";
      else if (p.maxStock > 0 && currentQty > p.maxStock) stockStatus = "overstock";
      return { ...p, currentQty, stockStatus };
    });

    if (lowStockOnly) {
      items = items.filter((i) => i.stockStatus === "low" || i.stockStatus === "out_of_stock");
    }

    const total = items.length;
    const paged = items.slice((page - 1) * pageSize, page * pageSize);

    return {
      items: paged,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async getStockMovements(params: StockMovementParams): Promise<PaginatedResponse<unknown>> {
    const { page, pageSize, search, productId, warehouseId, movementType, dateFrom, dateTo } = params;

    const where: Record<string, unknown> = {};
    if (productId) where.productId = productId;
    if (warehouseId) where.warehouseId = warehouseId;
    if (movementType) where.movementType = movementType;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
    }
    if (search) {
      where.OR = [
        { product: { name: { contains: search, mode: "insensitive" } } },
        { product: { sku: { contains: search, mode: "insensitive" } } },
        { notes: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.stockLedger.findMany({
        where,
        include: {
          product: { select: { id: true, sku: true, name: true } },
          warehouse: { select: { id: true, name: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.stockLedger.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  static async getStockValuation(warehouseId?: string) {
    const productWhere: Record<string, unknown> = { deletedAt: null };

    const products = await prisma.product.findMany({
      where: productWhere,
      select: { id: true, sku: true, name: true, category: true, capitalCost: true, baseUom: true },
      orderBy: { name: "asc" },
    });

    const ledgerWhere: Record<string, unknown> = {};
    if (warehouseId) ledgerWhere.warehouseId = warehouseId;

    const stockAgg = await prisma.stockLedger.groupBy({
      by: ["productId"],
      where: ledgerWhere,
      _sum: { qty: true },
    });

    const stockMap = new Map<string, number>();
    for (const row of stockAgg) {
      stockMap.set(row.productId, row._sum.qty ?? 0);
    }

    const items = products.map((p) => {
      const currentQty = stockMap.get(p.id) ?? 0;
      const totalValue = currentQty * p.capitalCost;
      return { ...p, currentQty, totalValue };
    }).filter((i) => i.currentQty !== 0);

    const totalValuation = items.reduce((sum, i) => sum + i.totalValue, 0);

    return { items, totalValuation };
  }

  static async manualAdjustment(
    data: z.infer<typeof manualAdjustmentSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ) {
    const parsed = manualAdjustmentSchema.parse(data);

    const product = await prisma.product.findUnique({ where: { id: parsed.productId } });
    if (!product) throw new Error("Product not found");

    const warehouse = await prisma.warehouse.findUnique({ where: { id: parsed.warehouseId } });
    if (!warehouse) throw new Error("Warehouse not found");

    const entry = await prisma.stockLedger.create({
      data: {
        productId: parsed.productId,
        warehouseId: parsed.warehouseId,
        movementType: "ADJUSTMENT",
        qty: parsed.qty,
        referenceType: "ManualAdjustment",
        notes: parsed.notes,
        createdBy: userId,
      },
    });

    await AuditService.logCreate({
      userId,
      userRole,
      ipAddress,
      entityType: "StockAdjustment",
      entityId: entry.id,
      entityLabel: `${product.sku} ${parsed.qty > 0 ? "+" : ""}${parsed.qty}`,
      data: {
        productId: parsed.productId,
        warehouseId: parsed.warehouseId,
        qty: parsed.qty,
        notes: parsed.notes,
      },
    });

    return entry;
  }

  static async getLowStockProducts(limit = 10) {
    const products = await prisma.product.findMany({
      where: { deletedAt: null, minStock: { gt: 0 } },
      select: {
        id: true, sku: true, name: true, minStock: true, baseUom: true, category: true,
      },
      orderBy: { name: "asc" },
    });

    const stockAgg = await prisma.stockLedger.groupBy({
      by: ["productId"],
      _sum: { qty: true },
    });

    const stockMap = new Map<string, number>();
    for (const row of stockAgg) {
      stockMap.set(row.productId, row._sum.qty ?? 0);
    }

    return products
      .map((p) => {
        const currentQty = stockMap.get(p.id) ?? 0;
        return { ...p, currentQty, deficit: p.minStock - currentQty };
      })
      .filter((p) => p.currentQty < p.minStock)
      .sort((a, b) => b.deficit - a.deficit)
      .slice(0, limit);
  }
}
