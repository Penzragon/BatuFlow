import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    arInvoice: {
      findMany: vi.fn(),
    },
  },
}));

describe("invoice.service", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("getAgingReport buckets invoices by days past due", async () => {
    const { InvoiceService } = await import("../invoice.service");
    const { prisma } = await import("@/lib/db");

    const now = new Date();
    const past30 = new Date(now);
    past30.setDate(past30.getDate() - 15);
    const past60 = new Date(now);
    past60.setDate(past60.getDate() - 45);

    (prisma.arInvoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { grandTotal: 1000, amountPaid: 0, dueDate: past30 },
      { grandTotal: 500, amountPaid: 0, dueDate: past60 },
    ]);

    const result = await InvoiceService.getAgingReport();
    expect(result).toHaveLength(6);
    const current = result.find((b) => b.label === "current");
    const bucket1_30 = result.find((b) => b.label === "1-30");
    const bucket31_60 = result.find((b) => b.label === "31-60");
    expect(current).toBeDefined();
    expect(bucket1_30).toBeDefined();
    expect(bucket31_60).toBeDefined();
    expect(bucket1_30!.count).toBe(1);
    expect(bucket1_30!.amount).toBe(1000);
    expect(bucket31_60!.count).toBe(1);
    expect(bucket31_60!.amount).toBe(500);
  });
});
