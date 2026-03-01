import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";

export const GET = apiHandler(async (req) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  if (!q || q.length < 2) {
    return successResponse([]);
  }

  const products = await prisma.product.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true, sku: true, name: true, baseUom: true, minStock: true, maxStock: true,
    },
    take: 20,
    orderBy: { name: "asc" },
  });

  const stockAgg = await prisma.stockLedger.groupBy({
    by: ["productId", "warehouseId"],
    where: { productId: { in: products.map((p) => p.id) } },
    _sum: { qty: true },
  });

  const warehouseIds = [...new Set(stockAgg.map((s) => s.warehouseId))];
  const warehouses = await prisma.warehouse.findMany({
    where: { id: { in: warehouseIds } },
    select: { id: true, name: true },
  });
  const whMap = new Map(warehouses.map((w) => [w.id, w.name]));

  const results = products.map((p) => {
    const stockEntries = stockAgg
      .filter((s) => s.productId === p.id)
      .map((s) => ({
        warehouseId: s.warehouseId,
        warehouseName: whMap.get(s.warehouseId) ?? "Unknown",
        qty: s._sum.qty ?? 0,
      }));
    const totalQty = stockEntries.reduce((sum, e) => sum + e.qty, 0);
    return { ...p, totalQty, warehouses: stockEntries };
  });

  return successResponse(results);
});
