import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    salesOrder: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    customerVisit: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    arInvoice: {
      findMany: vi.fn(),
    },
    deliveryOrder: {
      findUnique: vi.fn(),
    },
  },
}));

describe("service scope enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("SalesOrderService.listSOs applies staff scope filter", async () => {
    const { SalesOrderService } = await import("../sales-order.service");
    const { prisma } = await import("@/lib/db");

    (prisma.salesOrder.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.salesOrder.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    await SalesOrderService.listSOs({
      page: 1,
      pageSize: 20,
      viewer: { id: "staff-1", role: "STAFF" },
    });

    const whereArg = (prisma.salesOrder.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    expect(whereArg.OR).toEqual([
      { createdBy: "staff-1" },
      { customer: { salespersonId: "staff-1" } },
    ]);
  });

  it("VisitService.listVisits forces salespersonId for staff viewer", async () => {
    const { VisitService } = await import("../visit.service");
    const { prisma } = await import("@/lib/db");

    (prisma.customerVisit.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.customerVisit.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    await VisitService.listVisits({
      page: 1,
      pageSize: 20,
      salespersonId: "someone-else",
      viewer: { id: "staff-2", role: "STAFF" },
    });

    const whereArg = (prisma.customerVisit.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    expect(whereArg.salespersonId).toBe("staff-2");
  });

  it("InvoiceService.getAgingReport blocks non manager/admin", async () => {
    const { InvoiceService } = await import("../invoice.service");

    await expect(
      InvoiceService.getAgingReport({ id: "staff-1", role: "STAFF" })
    ).rejects.toMatchObject({ message: "Forbidden", status: 403 });
  });

  it("DeliveryOrderService.getDO hides unauthorized records from staff", async () => {
    const { DeliveryOrderService } = await import("../delivery-order.service");
    const { prisma } = await import("@/lib/db");

    (prisma.deliveryOrder.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "do-1",
      salesOrder: {
        createdBy: "other-user",
        customer: { salespersonId: "other-user" },
      },
    });

    await expect(
      DeliveryOrderService.getDO("do-1", { id: "staff-1", role: "STAFF" })
    ).rejects.toThrow("Delivery order not found");
  });
});
