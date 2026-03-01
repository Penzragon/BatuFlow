import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { TripService } from "@/services/trip.service";
import { PrintLayout } from "@/components/print/print-layout";
import { format } from "date-fns";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TripPrintPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) notFound();

  const { id } = await params;
  let trip: Awaited<ReturnType<typeof TripService.getTrip>>;
  try {
    trip = await TripService.getTrip(id);
  } catch {
    notFound();
  }

  if (!trip) notFound();

  return (
    <PrintLayout
      companyName="BatuFlow"
      title={`Trip Sheet — ${trip.tripNumber}`}
      footer="Driver: please confirm handover and delivery status for each DO."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-gray-700">Driver / Vehicle</p>
            <p className="font-semibold">{trip.driver.name}</p>
            <p>{trip.vehicle.plateNumber} — {trip.vehicle.vehicleType}</p>
          </div>
          <div className="text-right">
            <p><span className="text-gray-600">Trip:</span> {trip.tripNumber}</p>
            <p><span className="text-gray-600">Date:</span> {format(new Date(trip.tripDate), "dd MMM yyyy")}</p>
            <p><span className="text-gray-600">Status:</span> {trip.status}</p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Delivery Orders</p>
          <table className="w-full border border-gray-200 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border-b border-gray-200 px-2 py-2 text-left">DO #</th>
                <th className="border-b border-gray-200 px-2 py-2 text-left">Customer</th>
                <th className="border-b border-gray-200 px-2 py-2 text-left">Address</th>
                <th className="border-b border-gray-200 px-2 py-2 text-left">Items</th>
              </tr>
            </thead>
            <tbody>
              {trip.deliveryOrders.map((do_) => (
                <tr key={do_.id} className="border-b border-gray-100">
                  <td className="px-2 py-2 font-medium">{do_.doNumber}</td>
                  <td className="px-2 py-2">{do_.salesOrder.customer.name}</td>
                  <td className="px-2 py-2 text-gray-600">{do_.salesOrder.customer.address ?? "—"}</td>
                  <td className="px-2 py-2">
                    {do_.lines.map((l) => `${l.productName} × ${l.qtyDelivered}`).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PrintLayout>
  );
}
