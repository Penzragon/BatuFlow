import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import { JournalService } from "./journal.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { Payment } from "@prisma/client";

export const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().min(0.01),
  method: z.enum(["CASH", "TRANSFER", "GIRO", "CHECK", "OTHER"]),
  reference: z.string().optional(),
  paymentDate: z.string(),
  notes: z.string().optional(),
});

/**
 * Records payments against AR Invoices and maintains
 * the invoice paid/partially-paid status.
 */
export class PaymentService {
  /**
   * Records a payment for an invoice. Updates the invoice's amount_paid
   * and transitions the status to PARTIALLY_PAID or PAID.
   */
  static async recordPayment(
    data: z.infer<typeof recordPaymentSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Payment> {
    const parsed = recordPaymentSchema.parse(data);

    const invoice = await prisma.arInvoice.findUnique({
      where: { id: parsed.invoiceId },
    });
    if (!invoice) throw new Error("Invoice not found");
    if (["DRAFT", "PAID"].includes(invoice.status)) {
      throw new Error(
        invoice.status === "DRAFT"
          ? "Invoice must be issued before recording payments"
          : "Invoice is already fully paid"
      );
    }

    const newAmountPaid = invoice.amountPaid + parsed.amount;
    const balance = invoice.grandTotal - newAmountPaid;

    if (parsed.amount > invoice.grandTotal - invoice.amountPaid + 0.01) {
      throw new Error("Payment amount exceeds remaining balance");
    }

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          invoiceId: parsed.invoiceId,
          amount: parsed.amount,
          method: parsed.method,
          reference: parsed.reference ?? null,
          paymentDate: new Date(parsed.paymentDate),
          notes: parsed.notes ?? null,
          createdBy: userId,
        },
      });

      const newStatus = balance <= 0.01 ? "PAID" : "PARTIALLY_PAID";
      await tx.arInvoice.update({
        where: { id: parsed.invoiceId },
        data: {
          amountPaid: newAmountPaid,
          status: newStatus,
        },
      });

      return p;
    });

    await AuditService.logCreate({
      userId, userRole, ipAddress,
      entityType: "Payment", entityId: payment.id,
      entityLabel: `Payment for ${invoice.invoiceNumber}`,
      data: {
        invoiceId: invoice.invoiceNumber,
        amount: parsed.amount,
        method: parsed.method,
        reference: parsed.reference,
      },
    });

    try {
      await JournalService.autoPostFromPayment(
        payment.id,
        invoice.invoiceNumber,
        parsed.amount,
        parsed.method,
        userId, userRole, ipAddress
      );
    } catch {
      // Auto-posting is best-effort
    }

    return payment;
  }

  /**
   * Lists payments for a specific invoice.
   */
  static async listPaymentsForInvoice(
    invoiceId: string,
    viewer?: { id: string; role: string }
  ): Promise<Payment[]> {
    if (viewer?.role === "STAFF") {
      const invoice = await prisma.arInvoice.findUnique({
        where: { id: invoiceId },
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

      const allowed =
        invoice.deliveryOrder?.salesOrder?.createdBy === viewer.id ||
        invoice.deliveryOrder?.salesOrder?.customer?.salespersonId === viewer.id;
      if (!allowed) throw new Error("Invoice not found");
    }

    return prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { paymentDate: "desc" },
    });
  }

  /**
   * Lists all payments with pagination.
   */
  static async listAllPayments(
    params: PaginationParams
  ): Promise<PaginatedResponse<Payment>> {
    const { page, pageSize, search } = params;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { reference: { contains: search, mode: "insensitive" } },
        { invoice: { invoiceNumber: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          invoice: {
            select: { id: true, invoiceNumber: true, customer: { select: { id: true, name: true } } },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { paymentDate: "desc" },
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      items: items as unknown as Payment[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
