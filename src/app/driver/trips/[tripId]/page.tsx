"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Truck, MapPin, Package, CheckCircle, Clock, XCircle, ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface DeliveryOrderInTrip {
  id: string;
  doNumber: string;
  deliveryStatus: "PENDING" | "PICKED_UP" | "ON_THE_WAY" | "DELIVERED" | "FAILED";
  deliveredAt: string | null;
  failureReason: string | null;
  salesOrder: {
    soNumber: string;
    customer: { name: string; address: string | null; phone: string | null; gpsLatitude: number | null; gpsLongitude: number | null };
  };
  lines: { id: string; productName: string; qtyDelivered: number; uom: string }[];
}

interface TripDetail {
  id: string;
  tripNumber: string;
  status: "PLANNED" | "IN_PROGRESS";
  tripDate: string;
  vehicle: { plateNumber: string; vehicleType: string };
  deliveryOrders: DeliveryOrderInTrip[];
}

export default function DriverTripDetailPage() {
  const t = useTranslations("driver");
  const params = useParams();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const statusMeta: Record<string, { icon: React.ReactNode; labelKey: string; color: string }> = {
    PENDING: { icon: <Clock size={16} />, labelKey: "pending", color: "text-muted-foreground bg-muted/50" },
    PICKED_UP: { icon: <Package size={16} className="text-blue-500" />, labelKey: "pickedUp", color: "text-blue-700 bg-blue-50" },
    ON_THE_WAY: { icon: <Truck size={16} className="text-amber-500" />, labelKey: "onTheWay", color: "text-amber-700 bg-amber-50" },
    DELIVERED: { icon: <CheckCircle size={16} className="text-green-500" />, labelKey: "delivered", color: "text-green-700 bg-green-50" },
    FAILED: { icon: <XCircle size={16} className="text-red-500" />, labelKey: "failed", color: "text-red-700 bg-red-50" },
  };

  const fetchTrip = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      const data = await res.json();
      if (data.success) setTrip(data.data);
      else toast.error(t("tripNotFound"));
    } catch {
      toast.error(t("failedToLoadTrip"));
    } finally {
      setLoading(false);
    }
  }, [tripId, t]);

  useEffect(() => { fetchTrip(); }, [fetchTrip]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Truck size={24} className="mx-auto animate-bounce" />
          <p className="mt-2 text-sm">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!trip) return <div className="p-4 text-center text-muted-foreground">{t("tripNotFound")}</div>;

  const delivered = trip.deliveryOrders.filter((d) => d.deliveryStatus === "DELIVERED").length;
  const total = trip.deliveryOrders.length;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Link href="/driver/trips" className="rounded-full p-1 hover:bg-muted">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="font-bold">{trip.tripNumber}</h1>
          <p className="text-xs text-muted-foreground">{format(new Date(trip.tripDate), "dd MMM yyyy")} · {trip.vehicle.plateNumber}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">{t("progress")}</span>
          <span className="text-muted-foreground">{delivered}/{total} {t("deliveries")}</span>
        </div>
        <div className="h-3 w-full rounded-full bg-muted">
          <div
            className="h-3 rounded-full bg-green-500 transition-all"
            style={{ width: `${total > 0 ? (delivered / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Delivery Orders */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("deliveries")}</h2>
        {trip.deliveryOrders.map((dOrder, idx) => {
          const meta = statusMeta[dOrder.deliveryStatus];
          const canAction = dOrder.deliveryStatus !== "DELIVERED" && dOrder.deliveryStatus !== "FAILED" && trip.status === "IN_PROGRESS";

          return (
            <div key={dOrder.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="flex items-start justify-between p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{dOrder.salesOrder.customer.name}</p>
                    </div>
                    {dOrder.salesOrder.customer.address && (
                      <p className="text-xs text-muted-foreground">{dOrder.salesOrder.customer.address}</p>
                    )}
                    {dOrder.salesOrder.customer.gpsLatitude && dOrder.salesOrder.customer.gpsLongitude && (
                      <a
                        href={`https://maps.google.com/?q=${dOrder.salesOrder.customer.gpsLatitude},${dOrder.salesOrder.customer.gpsLongitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MapPin size={10} />
                        {t("openMaps")}
                        <ExternalLink size={10} />
                      </a>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {dOrder.lines.slice(0, 2).map((line) => (
                        <span key={line.id} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {line.productName} ×{line.qtyDelivered}
                        </span>
                      ))}
                      {dOrder.lines.length > 2 && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">+{dOrder.lines.length - 2} more</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${meta.color}`}>
                  {meta.icon}
                  {t(meta.labelKey)}
                </div>
              </div>

              {canAction && (
                <Link
                  href={`/driver/trips/${tripId}/dos/${dOrder.id}`}
                  className="flex items-center justify-between border-t bg-primary/5 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10"
                >
                  <span>{t("updateDeliveryStatus")}</span>
                  <ChevronRight size={16} />
                </Link>
              )}

              {dOrder.deliveryStatus === "FAILED" && dOrder.failureReason && (
                <div className="border-t bg-red-50 px-4 py-2 text-xs text-red-600">
                  Failed: {dOrder.failureReason.replace("_", " ")}
                </div>
              )}

              {dOrder.deliveryStatus === "DELIVERED" && dOrder.deliveredAt && (
                <div className="flex items-center gap-1 border-t bg-green-50 px-4 py-2 text-xs text-green-600">
                  <CheckCircle size={10} />
                  {t("deliveredAt")} {format(new Date(dOrder.deliveredAt), "HH:mm")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
