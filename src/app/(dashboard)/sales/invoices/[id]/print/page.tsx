import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { InvoiceService } from "@/services/invoice.service";
import { PrintLayout } from "@/components/print/print-layout";
import { PrintTable } from "@/components/print/print-table";
import { format } from "date-fns";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);
}

export default async function InvoicePrintPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) notFound();

  const { id } = await params;
  let invoice: Awaited<ReturnType<typeof InvoiceService.getInvoice>>;
  try {
    invoice = await InvoiceService.getInvoice(id);
  } catch {
    notFound();
  }

  if (!invoice) notFound();

  const lines = invoice.deliveryOrder.lines.map((line) => ({
    productName: line.productName,
    sku: line.productSku,
    qty: line.qtyDelivered,
    uom: line.uom ?? "pcs",
  }));

  return (
    <PrintLayout
      companyName="BatuFlow"
      title={`Invoice ${invoice.invoiceNumber}`}
      footer="Thank you for your business."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-gray-700">Bill To</p>
            <p className="font-semibold">{invoice.customer.name}</p>
            {invoice.customer.phone && <p>{invoice.customer.phone}</p>}
            {invoice.customer.email && <p>{invoice.customer.email}</p>}
          </div>
          <div className="text-right">
            <p><span className="text-gray-600">Invoice:</span> {invoice.invoiceNumber}</p>
            <p><span className="text-gray-600">Date:</span> {invoice.issuedAt ? format(new Date(invoice.issuedAt), "dd MMM yyyy") : format(new Date(invoice.createdAt), "dd MMM yyyy")}</p>
            <p><span className="text-gray-600">Due Date:</span> {format(new Date(invoice.dueDate), "dd MMM yyyy")}</p>
            <p><span className="text-gray-600">DO:</span> {invoice.deliveryOrder.doNumber}</p>
          </div>
        </div>

        <PrintTable
          caption="Line Items"
          columns={[
            { key: "productName", header: "Product" },
            { key: "sku", header: "SKU" },
            { key: "qty", header: "Qty", align: "right" },
            { key: "uom", header: "UOM" },
          ]}
          data={lines}
        />

        <div className="mt-4 flex justify-end">
          <table className="w-full max-w-xs text-sm">
            <tbody>
              <tr>
                <td className="py-1 text-gray-600">Subtotal</td>
                <td className="py-1 text-right font-medium">{formatCurrency(invoice.subtotal)}</td>
              </tr>
              {invoice.ppnAmount > 0 && (
                <tr>
                  <td className="py-1 text-gray-600">PPN (11%)</td>
                  <td className="py-1 text-right font-medium">{formatCurrency(invoice.ppnAmount)}</td>
                </tr>
              )}
              <tr>
                <td className="py-2 font-semibold">Grand Total</td>
                <td className="py-2 text-right font-semibold">{formatCurrency(invoice.grandTotal)}</td>
              </tr>
              {invoice.amountPaid > 0 && (
                <tr>
                  <td className="py-1 text-gray-600">Amount Paid</td>
                  <td className="py-1 text-right">{formatCurrency(invoice.amountPaid)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PrintLayout>
  );
}
