import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { Product } from "@prisma/client";

/** Validation schema for creating a new product. */
export const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  baseUom: z.string().default("pcs"),
  capitalCost: z.number().min(0).default(0),
  sellPrice: z.number().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
  maxStock: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

/** Validation schema for updating an existing product (all fields optional). */
export const updateProductSchema = createProductSchema.partial();

/** Validation schema for a single price tier row. */
const priceTierSchema = z.object({
  minQty: z.number().int().min(1),
  maxQty: z.number().int().min(1).nullable(),
  unitPrice: z.number().min(0),
});

/** Validation schema for the full price tiers replacement payload. */
export const priceTiersSchema = z.object({
  tiers: z.array(priceTierSchema),
});

/** Validation schema for a single UOM conversion row. */
const uomConversionSchema = z.object({
  fromUom: z.string().min(1),
  toUom: z.string().min(1),
  conversionRate: z.number().min(0),
});

/** Validation schema for the full UOM conversions replacement payload. */
export const uomConversionsSchema = z.object({
  conversions: z.array(uomConversionSchema),
});

/** Extended params for product list filtering beyond standard pagination. */
interface ProductListParams extends PaginationParams {
  category?: string;
  brand?: string;
  isActive?: boolean;
}

/**
 * Service layer for all product-related business operations.
 * Encapsulates data access, validation, audit logging, and
 * capital-cost change tracking for the Product Master module.
 */
export class ProductService {
  /**
   * Returns a paginated list of non-deleted products.
   * Supports text search across SKU and name, plus optional
   * category, brand, and active-status filters.
   */
  static async listProducts(
    params: ProductListParams
  ): Promise<PaginatedResponse<Product>> {
    const { page, pageSize, search, sortBy, sortOrder, category, brand, isActive } = params;

    const where: Record<string, unknown> = { deletedAt: null };

    if (search) {
      where.OR = [
        { sku: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }
    if (category) where.category = category;
    if (brand) where.brand = brand;
    if (isActive !== undefined) where.isActive = isActive;

    const orderBy: Record<string, string> = {};
    orderBy[sortBy ?? "createdAt"] = sortOrder ?? "desc";

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Fetches a single product by ID, including price tiers, UOM conversions,
   * capital cost history, and sell price history. Resolves "changed by" user IDs
   * to names for display. Throws if the product does not exist or is soft-deleted.
   */
  static async getProduct(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        priceTiers: { orderBy: { minQty: "asc" } },
        uomConversions: true,
        capitalHistory: { orderBy: { changedAt: "desc" } },
        sellPriceHistory: { orderBy: { changedAt: "desc" } },
      },
    });

    if (!product || product.deletedAt) {
      throw Object.assign(new Error("Product not found"), { status: 404 });
    }

    const userIds = new Set<string>();
    for (const h of product.capitalHistory) userIds.add(h.changedBy);
    for (const h of product.sellPriceHistory) userIds.add(h.changedBy);
    const users =
      userIds.size > 0
        ? await prisma.user.findMany({
            where: { id: { in: [...userIds] } },
            select: { id: true, name: true },
          })
        : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

    return {
      ...product,
      capitalHistory: product.capitalHistory.map((h) => ({
        ...h,
        changedByName: userMap[h.changedBy] ?? h.changedBy,
      })),
      sellPriceHistory: product.sellPriceHistory.map((h) => ({
        ...h,
        changedByName: userMap[h.changedBy] ?? h.changedBy,
      })),
    };
  }

  /**
   * Creates a new product record and writes a CREATE audit log.
   * If a soft-deleted product with the same SKU exists, it is restored and
   * updated with the new data instead of creating a duplicate (SKU is unique).
   * Validates the input against the createProductSchema first.
   */
  static async createProduct(
    data: z.infer<typeof createProductSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ) {
    const existing = await prisma.product.findFirst({
      where: { sku: data.sku },
    });

    if (existing) {
      if (existing.deletedAt) {
        const restored = await prisma.product.update({
          where: { id: existing.id },
          data: {
            ...data,
            deletedAt: null,
          },
        });
        await prisma.productCapitalHistory.deleteMany({
          where: { productId: existing.id },
        });
        await prisma.productSellPriceHistory.deleteMany({
          where: { productId: existing.id },
        });
        await AuditService.logCreate({
          userId,
          userRole,
          ipAddress,
          entityType: "Product",
          entityId: restored.id,
          entityLabel: `${restored.sku} – ${restored.name}`,
          data: restored as unknown as Record<string, unknown>,
          metadata: { restored: true },
        });
        return restored;
      }
      const err = new Error(
        "A product with this SKU already exists. Please use a different SKU."
      );
      (err as Error & { status: number }).status = 409;
      throw err;
    }

    const product = await prisma.product.create({ data });

    await AuditService.logCreate({
      userId,
      userRole,
      ipAddress,
      entityType: "Product",
      entityId: product.id,
      entityLabel: `${product.sku} – ${product.name}`,
      data: product as unknown as Record<string, unknown>,
    });

    return product;
  }

  /**
   * Updates an existing product. If the capital cost changed, a
   * ProductCapitalHistory record is inserted to track the delta.
   * Also writes an UPDATE audit log with field-level diffs.
   */
  static async updateProduct(
    id: string,
    data: z.infer<typeof updateProductSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw Object.assign(new Error("Product not found"), { status: 404 });
    }

    const updated = await prisma.product.update({ where: { id }, data });

    if (
      data.capitalCost !== undefined &&
      data.capitalCost !== existing.capitalCost
    ) {
      await prisma.productCapitalHistory.create({
        data: {
          productId: id,
          oldCost: existing.capitalCost,
          newCost: data.capitalCost,
          changedBy: userId,
          source: "manual",
          notes: null,
        },
      });
    }

    if (
      data.sellPrice !== undefined &&
      data.sellPrice !== existing.sellPrice
    ) {
      await prisma.productSellPriceHistory.create({
        data: {
          productId: id,
          oldPrice: existing.sellPrice,
          newPrice: data.sellPrice,
          changedBy: userId,
          source: "manual",
          notes: null,
        },
      });
    }

    await AuditService.logUpdate({
      userId,
      userRole,
      ipAddress,
      entityType: "Product",
      entityId: id,
      entityLabel: `${updated.sku} – ${updated.name}`,
      oldData: existing as unknown as Record<string, unknown>,
      newData: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  /**
   * Soft-deletes a product by setting its deletedAt timestamp.
   * Writes a DELETE audit log with the record's last-known state.
   */
  static async deleteProduct(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw Object.assign(new Error("Product not found"), { status: 404 });
    }

    await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await AuditService.logDelete({
      userId,
      userRole,
      ipAddress,
      entityType: "Product",
      entityId: id,
      entityLabel: `${existing.sku} – ${existing.name}`,
      data: existing as unknown as Record<string, unknown>,
    });
  }

  /**
   * Returns the capital cost change history for a product,
   * ordered newest-first. Each entry shows old cost, new cost,
   * who changed it, the source, and optional notes.
   */
  static async getCapitalHistory(productId: string) {
    return prisma.productCapitalHistory.findMany({
      where: { productId },
      orderBy: { changedAt: "desc" },
    });
  }

  /**
   * Replaces all price tiers for a product in a single transaction.
   * Deletes existing tiers first, then bulk-inserts the new set.
   * Writes an UPDATE audit log noting the tier replacement.
   */
  static async setPriceTiers(
    productId: string,
    tiers: z.infer<typeof priceTiersSchema>["tiers"],
    userId: string,
    userRole: string,
    ipAddress?: string
  ) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.deletedAt) {
      throw Object.assign(new Error("Product not found"), { status: 404 });
    }

    await prisma.$transaction([
      prisma.productPriceTier.deleteMany({ where: { productId } }),
      ...tiers.map((t) =>
        prisma.productPriceTier.create({
          data: { productId, minQty: t.minQty, maxQty: t.maxQty, unitPrice: t.unitPrice },
        })
      ),
    ]);

    await AuditService.logUpdate({
      userId,
      userRole,
      ipAddress,
      entityType: "Product",
      entityId: productId,
      entityLabel: `${product.sku} – ${product.name}`,
      oldData: {},
      newData: { priceTiers: JSON.stringify(tiers) },
      metadata: { subEntity: "priceTiers" },
    });

    return prisma.productPriceTier.findMany({
      where: { productId },
      orderBy: { minQty: "asc" },
    });
  }

  /**
   * Replaces all UOM conversions for a product in a single transaction.
   * Deletes existing conversions first, then bulk-inserts the new set.
   */
  static async setUomConversions(
    productId: string,
    conversions: z.infer<typeof uomConversionsSchema>["conversions"]
  ) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.deletedAt) {
      throw Object.assign(new Error("Product not found"), { status: 404 });
    }

    await prisma.$transaction([
      prisma.productUomConversion.deleteMany({ where: { productId } }),
      ...conversions.map((c) =>
        prisma.productUomConversion.create({
          data: {
            productId,
            fromUom: c.fromUom,
            toUom: c.toUom,
            conversionRate: c.conversionRate,
          },
        })
      ),
    ]);

    return prisma.productUomConversion.findMany({
      where: { productId },
    });
  }
}
