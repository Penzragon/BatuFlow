import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

describe("dashboard.service", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("getLowStockProducts returns only products where currentStock < minStock", async () => {
    const { getLowStockProducts } = await import("../dashboard.service");
    const { prisma } = await import("@/lib/db");

    (prisma.product.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "p1", sku: "SKU1", name: "Product 1", minStock: 10 },
      { id: "p2", sku: "SKU2", name: "Product 2", minStock: 5 },
    ]);
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      { product_id: "p1", current_stock: 8 },
      { product_id: "p2", current_stock: 10 },
    ]);

    const result = await getLowStockProducts();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
    expect(result[0].currentStock).toBe(8);
    expect(result[0].minStock).toBe(10);
  });
});
