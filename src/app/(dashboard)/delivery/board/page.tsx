"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { RefreshCw, Truck, User, CheckCircle, XCircle, Clock, Package, MapPin } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";

interface DOInBoard {
  id: string;
  doNumber: string;
  deliveryStatus: "PENDING" | "PICKED_UP" | "ON_THE_WAY" | "DELIVERED" | "FAILED";
  proofPhotoUrl: string | null;
  deliveredAt: string | null;
  failureReason: string | null;
  salesOrder: { customer: { id: string; name: string; address: string | null } };
}

interface TripInBoard {
  id: string;
  tripNumber: string;
  status: "PLANNED" | "IN_PROGRESS";
  tripDate: string;
  driver: { id: string; name: string };
  vehicle: { id: string; plateNumber: string; vehicleType: string };
  deliveryOrders: DOInBoard[];
}

const statusIcons: Record<string, React.ReactNode> = {
  PENDING: <Clock size={12} className="text-muted-foreground" />,
  PICKED_UP: <Package size={12} className="text-blue-500" />,
  ON_THE_WAY: <Truck size={12} className="text-amber-500" />,
  DELIVERED: <CheckCircle size={12} className="text-green-500" />,
  FAILED: <XCircle size={12} className="text-red-500" />,
};

export default function DeliveryBoardPage() {
  const t = useTranslations("trips");
  const td = useTranslations("delivery");
  const tc = useTranslations("common");
  const router = useRouter();

  const [trips, setTrips] = useState<TripInBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/trips/board");
      const data = await res.json();
      if (data.success) {
        setTrips(data.data);
        setLastUpdated(new Date());
      }
    } catch {
      toast.error("Failed to load delivery board");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard();
    const interval = setInterval(fetchBoard, 30000);
    return () => clearInterval(interval);
  }, [fetchBoard]);

  const statusLabel: Record<string, string> = {
    PENDING: td("pending"),
    PICKED_UP: td("pickedUp"),
    ON_THE_WAY: td("onTheWay"),
    DELIVERED: td("delivered"),
    FAILED: td("failed"),
  };

  const tripStatusLabel: Record<string, string> = {
    PLANNED: t("planned"),
    IN_PROGRESS: t("inProgress"),
  };

  const vehicleTypeLabel: Record<string, string> = { TRUCK: "Truck", VAN: "Van", MOTORCYCLE: "Motorcycle" };

  const getProgressColor = (delivered: number, total: number) => {
    if (total === 0) return "bg-muted";
    const ratio = delivered / total;
    if (ratio === 1) return "bg-green-500";
    if (ratio >= 0.5) return "bg-amber-500";
    return "bg-blue-500";
  };

  return (
    <>
      <PageHeader
        title={t("board")}
        description={t("boardDescription")}
        actions={
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Updated {format(lastUpdated, "HH:mm:ss")}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={fetchBoard} disabled={loading}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              {tc("refresh")}
            </Button>
          </div>
        }
      />

      <div className="p-6">
        {loading && trips.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">{tc("loading")}...</div>
        ) : trips.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Truck size={48} className="opacity-30" />
            <p>{t("noActiveTrips")}</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {trips.map((trip) => {
              const delivered = trip.deliveryOrders.filter((d) => d.deliveryStatus === "DELIVERED").length;
              const failed = trip.deliveryOrders.filter((d) => d.deliveryStatus === "FAILED").length;
              const total = trip.deliveryOrders.length;

              return (
                <Card key={trip.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push(`/delivery/trips/${trip.id}`)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm font-mono">{trip.tripNumber}</CardTitle>
                        <p className="text-xs text-muted-foreground">{format(new Date(trip.tripDate), "dd MMM yyyy")}</p>
                      </div>
                      <StatusBadge status={trip.status.toLowerCase().replace("_", "-")} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><User size={10} />{trip.driver.name}</span>
                      <span className="flex items-center gap-1"><Truck size={10} />{trip.vehicle.plateNumber}</span>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span>{delivered}/{total} delivered</span>
                        {failed > 0 && <span className="text-destructive">{failed} failed</span>}
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className={`h-1.5 rounded-full ${getProgressColor(delivered, total)}`}
                          style={{ width: `${total > 0 ? (delivered / total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    {/* DO list */}
                    <div className="space-y-1">
                      {trip.deliveryOrders.map((dOrder) => (
                        <div key={dOrder.id} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1">
                          <div className="flex items-center gap-1.5 text-xs">
                            <MapPin size={10} className="text-muted-foreground" />
                            <span className="truncate max-w-[140px]">{dOrder.salesOrder.customer.name}</span>
                          </div>
                          <Badge variant="outline" className="h-5 gap-0.5 px-1.5 text-xs">
                            {statusIcons[dOrder.deliveryStatus]}
                            {statusLabel[dOrder.deliveryStatus]}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
