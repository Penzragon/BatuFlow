import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PrintLayout } from "@/components/print/print-layout";
import { PrintTable } from "@/components/print/print-table";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PickListPrintPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) notFound();

  const { id } = await params;

  const pl = await prisma.pickList.findUnique({
    where: { id },
    include: {
      lines: { include: { warehouseLocation: { select: { name: true } } } },
      deliveryOrder: {
        select: {
          doNumber: true,
          salesOrder: { select: { soNumber: true, customer: { select: { name: true } } } },
        },
      },
    },
  });

  if (!pl) notFound();

  const lines = pl.lines.map((line) => ({
    productName: line.productName,
    sku: line.productSku,
    qtyRequired: line.qtyRequired,
    location: line.warehouseLocation?.name ?? "—",
    check: "",
  }));

  return (
    <PrintLayout
      companyName="BatuFlow"
      title={`Pick List ${pl.pickListNumber}`}
      footer="Check each item as picked. Note any short picks."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-gray-700">DO / Customer</p>
            <p className="font-semibold">{pl.deliveryOrder.doNumber}</p>
            <p>{pl.deliveryOrder.salesOrder.customer.name}</p>
          </div>
          <div className="text-right">
            <p><span className="text-gray-600">Pick List:</span> {pl.pickListNumber}</p>
            <p><span className="text-gray-600">SO:</span> {pl.deliveryOrder.salesOrder.soNumber}</p>
          </div>
        </div>

        <PrintTable
          caption="Items to pick"
          columns={[
            { key: "check", header: "✓", align: "center" },
            { key: "productName", header: "Product" },
            { key: "sku", header: "SKU" },
            { key: "qtyRequired", header: "Qty", align: "right" },
            { key: "location", header: "Location" },
          ]}
          data={lines}
        />
      </div>
    </PrintLayout>
  );
}
