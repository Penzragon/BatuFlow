import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { StockService } from "@/services/stock.service";

export const GET = apiHandler(async () => {
  await getCurrentUser();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [pendingPickLists, pendingHandovers, todaysReceipts, lowStockProducts] = await Promise.all([
    prisma.pickList.count({ where: { status: { in: ["CREATED", "PICKING"] }, deletedAt: null } }),
    prisma.handover.count({ where: { status: "PENDING" } }),
    prisma.goodsReceipt.count({
      where: { receiptDate: { gte: today, lt: tomorrow }, deletedAt: null },
    }),
    StockService.getLowStockProducts(5),
  ]);

  return successResponse({
    pendingPickLists,
    pendingHandovers,
    todaysReceipts,
    lowStockProducts,
  });
});
