import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PrintLayout } from "@/components/print/print-layout";
import { PrintTable } from "@/components/print/print-table";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DeliveryOrderPrintPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) notFound();

  const { id } = await params;

  const do_ = await prisma.deliveryOrder.findUnique({
    where: { id, deletedAt: null },
    include: {
      lines: true,
      salesOrder: {
        select: {
          soNumber: true,
          customer: { select: { name: true, address: true, phone: true } },
        },
      },
      trip: {
        include: {
          driver: { select: { name: true } },
          vehicle: { select: { plateNumber: true } },
        },
      },
    },
  });

  if (!do_) notFound();

  const lines = do_.lines.map((line) => ({
    productName: line.productName,
    sku: line.productSku,
    qty: line.qtyDelivered,
    uom: line.uom ?? "pcs",
  }));

  return (
    <PrintLayout
      companyName="BatuFlow"
      title={`Packing Slip / Surat Jalan — ${do_.doNumber}`}
      footer="Please confirm receipt of goods."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-gray-700">Deliver To</p>
            <p className="font-semibold">{do_.salesOrder.customer.name}</p>
            {do_.salesOrder.customer.address && (
              <p className="text-gray-600">{do_.salesOrder.customer.address}</p>
            )}
            {do_.salesOrder.customer.phone && (
              <p>{do_.salesOrder.customer.phone}</p>
            )}
          </div>
          <div className="text-right">
            <p><span className="text-gray-600">DO Number:</span> {do_.doNumber}</p>
            <p><span className="text-gray-600">SO Number:</span> {do_.salesOrder.soNumber}</p>
            {do_.trip && (
              <>
                <p><span className="text-gray-600">Driver:</span> {do_.trip.driver.name}</p>
                <p><span className="text-gray-600">Vehicle:</span> {do_.trip.vehicle.plateNumber}</p>
              </>
            )}
          </div>
        </div>

        <PrintTable
          caption="Items"
          columns={[
            { key: "productName", header: "Product" },
            { key: "sku", header: "SKU" },
            { key: "qty", header: "Qty", align: "right" },
            { key: "uom", header: "UOM" },
          ]}
          data={lines}
        />
      </div>
    </PrintLayout>
  );
}
