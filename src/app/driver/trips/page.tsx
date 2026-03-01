"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Truck, ChevronRight, Package, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface DeliveryOrderItem {
  id: string;
  doNumber: string;
  deliveryStatus: "PENDING" | "PICKED_UP" | "ON_THE_WAY" | "DELIVERED" | "FAILED";
  salesOrder: { customer: { name: string } };
}

interface TripItem {
  id: string;
  tripNumber: string;
  status: "PLANNED" | "IN_PROGRESS";
  tripDate: string;
  vehicle: { plateNumber: string; vehicleType: string };
  deliveryOrders: DeliveryOrderItem[];
}

const statusIcons: Record<string, React.ReactNode> = {
  PENDING: <Clock size={12} className="text-muted-foreground" />,
  PICKED_UP: <Package size={12} className="text-blue-500" />,
  ON_THE_WAY: <Truck size={12} className="text-amber-500" />,
  DELIVERED: <CheckCircle size={12} className="text-green-500" />,
  FAILED: <XCircle size={12} className="text-red-500" />,
};

const statusColors: Record<string, string> = {
  PENDING: "text-muted-foreground",
  PICKED_UP: "text-blue-600",
  ON_THE_WAY: "text-amber-600",
  DELIVERED: "text-green-600",
  FAILED: "text-red-600",
};

const tripStatusColors: Record<string, string> = {
  PLANNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
};

export default function DriverTripsPage() {
  const t = useTranslations("driver");
  const [trips, setTrips] = useState<TripItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrips = useCallback(async () => {
    try {
      const res = await fetch("/api/driver/trips");
      const data = await res.json();
      if (data.success) setTrips(data.data);
    } catch {
      toast.error(t("failedToLoadTrips"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Truck size={24} className="mx-auto animate-bounce" />
          <p className="mt-2 text-sm">{t("loadingTrips")}</p>
        </div>
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 p-8 text-center">
        <Truck size={48} className="text-muted-foreground opacity-40" />
        <p className="font-medium">{t("noTripsToday")}</p>
        <p className="text-sm text-muted-foreground">{t("noTripsAssignedToday")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-bold">{t("myTrips")}</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, dd MMMM yyyy")}</p>
      </div>

      {trips.map((trip) => {
        const delivered = trip.deliveryOrders.filter((d) => d.deliveryStatus === "DELIVERED").length;
        const total = trip.deliveryOrders.length;

        return (
          <Link
            key={trip.id}
            href={`/driver/trips/${trip.id}`}
            className="block rounded-xl border bg-card shadow-sm hover:bg-accent"
          >
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">{trip.tripNumber}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tripStatusColors[trip.status]}`}>
                      {trip.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Truck size={10} />
                    <span>{trip.vehicle.plateNumber}</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </div>

              {/* Progress */}
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{delivered}/{total} {t("deliveredProgress")}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-green-500 transition-all"
                    style={{ width: `${total > 0 ? (delivered / total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* DO list preview */}
              <div className="mt-3 space-y-1.5">
                {trip.deliveryOrders.slice(0, 3).map((dOrder) => (
                  <div key={dOrder.id} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[200px]">{dOrder.salesOrder.customer.name}</span>
                    <span className={`flex items-center gap-1 text-xs ${statusColors[dOrder.deliveryStatus]}`}>
                      {statusIcons[dOrder.deliveryStatus]}
                      {dOrder.deliveryStatus.replace("_", " ")}
                    </span>
                  </div>
                ))}
                {trip.deliveryOrders.length > 3 && (
                  <p className="text-xs text-muted-foreground">+{trip.deliveryOrders.length - 3} more</p>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
