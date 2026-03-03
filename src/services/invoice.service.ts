import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import { createNotification } from "./notification.service";
import { JournalService } from "./journal.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { ArInvoice, InvoiceStatus } from "@prisma/client";

interface InvoiceListParams extends PaginationParams {
  status?: InvoiceStatus;
  customerId?: string;
  overdue?: boolean;
  dateFrom?: string;
  dateTo?: string;
  viewer?: { id: string; role: string };
}

interface AgingBucket {
  label: string;
  count: number;
  amount: number;
}

/**
 * Manages AR Invoices: generation from delivered DOs, issuance,
 * aging calculations, and overdue detection.
 */
export class InvoiceService {
  private static applyStaffScope(where: Record<string, unknown>, viewer?: { id: string; role: string }) {
    if (viewer?.role !== "STAFF") return;
    where.OR = [
      { deliveryOrder: { salesOrder: { createdBy: viewer.id } } },
      { deliveryOrder: { salesOrder: { customer: { salespersonId: viewer.id } } } },
    ];
  }

  private static assertStaffCanAccessInvoiceLike(
    source: { deliveryOrder?: { salesOrder?: { createdBy: string; customer?: { salespersonId: string | null } | null } | null } | null },
    viewer: { id: string; role: string },
    notFoundMessage = "Invoice not found"
  ) {
    if (viewer.role !== "STAFF") return;
    const so = source.deliveryOrder?.salesOrder;
    const allowed = !!so && (so.createdBy === viewer.id || so.customer?.salespersonId === viewer.id);
    if (!allowed) throw new Error(notFoundMessage);
  }

  private static assertManagerOrAdmin(viewer: { role: string }) {
    if (!["ADMIN", "MANAGER"].includes(viewer.role)) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
  }
  /**
   * Generates the next sequential invoice number (INV-YYYY-NNNNN).
   */
  static async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const last = await prisma.arInvoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: "desc" },
      select: { invoiceNumber: true },
    });
    const seq = last ? parseInt(last.invoiceNumber.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(5, "0")}`;
  }

  /**
   * Creates an AR Invoice from a confirmed Delivery Order.
   * Copies financial totals from the parent Sales Order and calculates
   * due date from the customer's payment terms.
   */
  static async createInvoice(
    doId: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<ArInvoice> {
    const deliveryOrder = await prisma.deliveryOrder.findUnique({
      where: { id: doId },
      include: {
        salesOrder: {
          include: { customer: { select: { id: true, name: true, paymentTermsDays: true, salespersonId: true } } },
        },
        lines: true,
      },
    });
    if (!deliveryOrder) throw new Error("Delivery order not found");
    InvoiceService.assertStaffCanAccessInvoiceLike(
      { deliveryOrder: { salesOrder: deliveryOrder.salesOrder } },
      { id: userId, role: userRole },
      "Delivery order not found"
    );
    if (deliveryOrder.status !== "CONFIRMED") {
      throw new Error("Delivery order must be confirmed before creating an invoice");
    }

    const so = deliveryOrder.salesOrder;
    const soLines = await prisma.salesOrderLine.findMany({
      where: { salesOrderId: so.id },
    });

    let subtotal = 0;
    for (const doLine of deliveryOrder.lines) {
      const soLine = soLines.find((l) => l.productId === doLine.productId);
      if (soLine) {
        const lineUnitAfterDiscount =
          soLine.unitPrice * (1 - soLine.discountPercent / 100);
        subtotal += lineUnitAfterDiscount * doLine.qtyDelivered;
      }
    }

    const ppnAmount = subtotal * so.ppnRate;
    const grandTotal = subtotal + ppnAmount;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (so.customer.paymentTermsDays ?? 30));

    const invoiceNumber = await InvoiceService.generateInvoiceNumber();

    const invoice = await prisma.arInvoice.create({
      data: {
        invoiceNumber,
        doId,
        customerId: so.customerId,
        status: "DRAFT",
        subtotal,
        ppnAmount,
        grandTotal,
        amountPaid: 0,
        dueDate,
        createdBy: userId,
      },
    });

    await AuditService.logCreate({
      userId, userRole, ipAddress,
      entityType: "ArInvoice", entityId: invoice.id, entityLabel: invoiceNumber,
      data: { invoiceNumber, doId: deliveryOrder.doNumber, customerId: so.customer.name, grandTotal },
    });

    return invoice;
  }

  /**
   * Issues a draft invoice, making it billable. Sets the issuedAt timestamp.
   */
  static async issueInvoice(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<ArInvoice> {
    const invoice = await prisma.arInvoice.findUnique({
      where: { id },
      include: {
        deliveryOrder: {
          include: {
            salesOrder: {
              include: { customer: { select: { salespersonId: true } } },
            },
          },
        },
      },
    });
    if (!invoice) throw new Error("Invoice not found");
    InvoiceService.assertStaffCanAccessInvoiceLike(invoice, { id: userId, role: userRole });
    if (invoice.status !== "DRAFT") throw new Error("Only draft invoices can be issued");

    const updated = await prisma.arInvoice.update({
      where: { id },
      data: { status: "ISSUED", issuedAt: new Date() },
    });

    try {
      await JournalService.autoPostFromInvoice(
        invoice.id,
        invoice.invoiceNumber,
        invoice.grandTotal,
        invoice.ppnAmount,
        userId, userRole, ipAddress
      );
    } catch {
      // Auto-posting is best-effort; don't block invoice issuance
    }

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "ArInvoice", entityId: id, entityLabel: invoice.invoiceNumber,
      oldData: { status: invoice.status },
      newData: { status: "ISSUED" },
    });

    return updated;
  }

  /**
   * Gets a single invoice with all related data.
   */
  static async getInvoice(id: string, viewer?: { id: string; role: string }) {
    const invoice = await prisma.arInvoice.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        deliveryOrder: {
          include: {
            lines: true,
            salesOrder: { select: { id: true, soNumber: true, createdBy: true, customer: { select: { salespersonId: true } } } },
          },
        },
        payments: { orderBy: { paymentDate: "desc" } },
      },
    });
    if (!invoice) throw new Error("Invoice not found");
    if (viewer) InvoiceService.assertStaffCanAccessInvoiceLike(invoice, viewer);
    return invoice;
  }

  /**
   * Returns paginated list of invoices with optional filters.
   */
  static async listInvoices(params: InvoiceListParams): Promise<PaginatedResponse<ArInvoice>> {
    const { page, pageSize, search, status, customerId, overdue, dateFrom, dateTo, viewer } = params;

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (overdue) {
      where.status = "OVERDUE";
    }
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo + "T23:59:59Z") } : {}),
      };
    }
    if (search) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { invoiceNumber: { contains: search, mode: "insensitive" } },
            { customer: { name: { contains: search, mode: "insensitive" } } },
          ],
        },
      ];
    }

    InvoiceService.applyStaffScope(where, viewer);

    const [items, total] = await Promise.all([
      prisma.arInvoice.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          deliveryOrder: { select: { id: true, doNumber: true, salesOrder: { select: { id: true, soNumber: true } } } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.arInvoice.count({ where }),
    ]);

    return {
      items: items as unknown as ArInvoice[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Generates an AR aging report with bucket breakdowns.
   */
  static async getAgingReport(viewer?: { id: string; role: string }): Promise<AgingBucket[]> {
    if (viewer) InvoiceService.assertManagerOrAdmin(viewer);
    const invoices = await prisma.arInvoice.findMany({
      where: {
        status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
        deletedAt: null,
      },
      select: {
        grandTotal: true,
        amountPaid: true,
        dueDate: true,
      },
    });

    const now = new Date();
    const buckets: AgingBucket[] = [
      { label: "current", count: 0, amount: 0 },
      { label: "1-30", count: 0, amount: 0 },
      { label: "31-60", count: 0, amount: 0 },
      { label: "61-90", count: 0, amount: 0 },
      { label: "91-120", count: 0, amount: 0 },
      { label: "120+", count: 0, amount: 0 },
    ];

    for (const inv of invoices) {
      const balance = inv.grandTotal - inv.amountPaid;
      if (balance <= 0) continue;

      const daysPastDue = Math.floor(
        (now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      let bucket: AgingBucket;
      if (daysPastDue <= 0) bucket = buckets[0];
      else if (daysPastDue <= 30) bucket = buckets[1];
      else if (daysPastDue <= 60) bucket = buckets[2];
      else if (daysPastDue <= 90) bucket = buckets[3];
      else if (daysPastDue <= 120) bucket = buckets[4];
      else bucket = buckets[5];

      bucket.count++;
      bucket.amount += balance;
    }

    return buckets;
  }

  /**
   * Marks issued invoices past their due date as Overdue.
   * Intended to be called periodically (e.g., via cron or on dashboard load).
   */
  static async checkOverdueInvoices(): Promise<number> {
    const overdueInvoices = await prisma.arInvoice.findMany({
      where: {
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
        dueDate: { lt: new Date() },
        deletedAt: null,
      },
      select: { id: true, invoiceNumber: true, customerId: true, createdBy: true },
    });

    if (overdueInvoices.length > 0) {
      await prisma.arInvoice.updateMany({
        where: { id: { in: overdueInvoices.map((i) => i.id) } },
        data: { status: "OVERDUE" },
      });

      const admins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true, deletedAt: null },
        select: { id: true },
      });

      for (const inv of overdueInvoices) {
        for (const admin of admins) {
          await createNotification({
            userId: admin.id,
            title: "Invoice Overdue",
            message: `Invoice ${inv.invoiceNumber} is past due.`,
            entityType: "ArInvoice",
            entityId: inv.id,
          });
        }
      }
    }

    return overdueInvoices.length;
  }
}
