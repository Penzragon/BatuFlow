"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Truck, CheckCircle, XCircle, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface PastDO {
  id: string;
  doNumber: string;
  deliveryStatus: "DELIVERED" | "FAILED" | "PENDING" | "PICKED_UP" | "ON_THE_WAY";
  deliveredAt: string | null;
  salesOrder: { customer: { name: string } };
}

interface PastTrip {
  id: string;
  tripNumber: string;
  tripDate: string;
  vehicle: { plateNumber: string };
  deliveryOrders: PastDO[];
}

export default function DriverHistoryPage() {
  const t = useTranslations("driver");
  const [trips, setTrips] = useState<PastTrip[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/driver/trips?history=true");
      const data = await res.json();
      if (data.success) setTrips(data.data);
    } catch {
      toast.error(t("failedToLoadHistory"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Truck size={24} className="animate-bounce" />
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 p-8 text-center">
        <Calendar size={48} className="text-muted-foreground opacity-40" />
        <p className="font-medium">{t("noDeliveryHistory")}</p>
        <p className="text-sm text-muted-foreground">{t("pastCompletedTrips")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-bold">{t("deliveryHistory")}</h1>
        <p className="text-sm text-muted-foreground">{t("pastCompletedTrips")}</p>
      </div>

      {trips.map((trip) => {
        const delivered = trip.deliveryOrders.filter((d) => d.deliveryStatus === "DELIVERED").length;
        const failed = trip.deliveryOrders.filter((d) => d.deliveryStatus === "FAILED").length;
        const total = trip.deliveryOrders.length;

        return (
          <div key={trip.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="flex items-start justify-between p-4">
              <div>
                <p className="font-mono text-sm font-bold">{trip.tripNumber}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <Calendar size={10} />
                  {format(new Date(trip.tripDate), "dd MMM yyyy")}
                  <span>·</span>
                  <Truck size={10} />
                  {trip.vehicle.plateNumber}
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle size={10} />
                  {delivered} delivered
                </div>
                {failed > 0 && (
                  <div className="flex items-center gap-1 text-red-500">
                    <XCircle size={10} />
                    {failed} failed
                  </div>
                )}
              </div>
            </div>

            <div className="border-t px-4 pb-3">
              <div className="h-1.5 w-full rounded-full bg-muted mt-2 mb-2">
                <div
                  className="h-1.5 rounded-full bg-green-500"
                  style={{ width: `${total > 0 ? (delivered / total) * 100 : 0}%` }}
                />
              </div>
              <div className="space-y-1">
                {trip.deliveryOrders.map((dOrder) => (
                  <div key={dOrder.id} className="flex items-center justify-between text-xs">
                    <span className="truncate max-w-[200px]">{dOrder.salesOrder.customer.name}</span>
                    <span className={`flex items-center gap-1 ${dOrder.deliveryStatus === "DELIVERED" ? "text-green-600" : "text-red-500"}`}>
                      {dOrder.deliveryStatus === "DELIVERED"
                        ? <CheckCircle size={10} />
                        : <XCircle size={10} />
                      }
                      {dOrder.deliveredAt ? format(new Date(dOrder.deliveredAt), "HH:mm") : dOrder.deliveryStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
