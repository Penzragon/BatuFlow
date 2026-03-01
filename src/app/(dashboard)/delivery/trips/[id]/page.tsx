"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft, MapPin, Package, CheckCircle, XCircle, Clock, Truck, User, Calendar, Play, Flag, Printer } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface DeliveryOrderInTrip {
  id: string;
  doNumber: string;
  deliveryStatus: "PENDING" | "PICKED_UP" | "ON_THE_WAY" | "DELIVERED" | "FAILED";
  proofPhotoUrl: string | null;
  deliveredAt: string | null;
  failureReason: string | null;
  failureNote: string | null;
  salesOrder: {
    id: string;
    soNumber: string;
    customer: { id: string; name: string; address: string | null; gpsLatitude: number | null; gpsLongitude: number | null };
  };
  lines: {
    id: string;
    productName: string;
    productSku: string;
    qtyDelivered: number;
    uom: string;
  }[];
}

interface TripDetail {
  id: string;
  tripNumber: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  tripDate: string;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  driver: { id: string; name: string; email: string };
  vehicle: { id: string; plateNumber: string; vehicleType: string };
  creator: { id: string; name: string };
  deliveryOrders: DeliveryOrderInTrip[];
}

const deliveryStatusIcons: Record<string, React.ReactNode> = {
  PENDING: <Clock size={14} className="text-muted-foreground" />,
  PICKED_UP: <Package size={14} className="text-blue-500" />,
  ON_THE_WAY: <Truck size={14} className="text-amber-500" />,
  DELIVERED: <CheckCircle size={14} className="text-green-500" />,
  FAILED: <XCircle size={14} className="text-red-500" />,
};

const deliveryStatusColor: Record<string, string> = {
  PENDING: "secondary",
  PICKED_UP: "default",
  ON_THE_WAY: "default",
  DELIVERED: "default",
  FAILED: "destructive",
};

export default function TripDetailPage() {
  const t = useTranslations("trips");
  const td = useTranslations("delivery");
  const tc = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<"start" | "complete" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [proofPhoto, setProofPhoto] = useState<string | null>(null);

  const fetchTrip = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${id}`);
      const data = await res.json();
      if (data.success) setTrip(data.data);
      else toast.error("Trip not found");
    } catch {
      toast.error("Failed to load trip");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchTrip(); }, [fetchTrip]);

  const handleAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/trips/${id}/${confirmAction}`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(confirmAction === "start" ? t("tripStarted") : t("tripCompleted"));
      setConfirmAction(null);
      fetchTrip();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setActionLoading(false);
    }
  };

  const statusLabel: Record<string, string> = {
    PLANNED: t("planned"),
    IN_PROGRESS: t("inProgress"),
    COMPLETED: t("completed"),
  };

  const deliveryStatusLabel: Record<string, string> = {
    PENDING: td("pending"),
    PICKED_UP: td("pickedUp"),
    ON_THE_WAY: td("onTheWay"),
    DELIVERED: td("delivered"),
    FAILED: td("failed"),
  };

  const failureReasonLabel: Record<string, string> = {
    CUSTOMER_ABSENT: td("customerAbsent"),
    WRONG_ADDRESS: td("wrongAddress"),
    CUSTOMER_REFUSED: td("customerRefused"),
    OTHER: td("other"),
  };

  const vehicleTypeLabel: Record<string, string> = { TRUCK: "Truck", VAN: "Van", MOTORCYCLE: "Motorcycle" };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">{tc("loading")}...</div>;
  }

  if (!trip) return null;

  const deliveredCount = trip.deliveryOrders.filter((d) => d.deliveryStatus === "DELIVERED").length;
  const failedCount = trip.deliveryOrders.filter((d) => d.deliveryStatus === "FAILED").length;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/delivery/trips")}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{trip.tripNumber}</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(trip.tripDate), "dd MMMM yyyy")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href={`/delivery/trips/${trip.id}/print`} target="_blank" rel="noopener noreferrer" title="Print trip sheet">
              <Printer size={16} />
            </Link>
          </Button>
          <StatusBadge status={trip.status.toLowerCase().replace("_", "-")} />
          {trip.status === "PLANNED" && (
            <Button onClick={() => setConfirmAction("start")}>
              <Play size={14} className="mr-1" />
              {t("startTrip")}
            </Button>
          )}
          {trip.status === "IN_PROGRESS" && (
            <Button variant="outline" onClick={() => setConfirmAction("complete")}>
              <Flag size={14} className="mr-1" />
              {t("completeTrip")}
            </Button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><User size={14} />{t("driver")}</div>
            <p className="mt-1 font-medium">{trip.driver.name}</p>
            <p className="text-xs text-muted-foreground">{trip.driver.email}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Truck size={14} />{t("vehicle")}</div>
            <p className="mt-1 font-medium">{trip.vehicle.plateNumber}</p>
            <p className="text-xs text-muted-foreground">{vehicleTypeLabel[trip.vehicle.vehicleType]}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Calendar size={14} />Progress</div>
            <p className="mt-1 font-medium">{deliveredCount} / {trip.deliveryOrders.length} delivered</p>
            {failedCount > 0 && <p className="text-xs text-destructive">{failedCount} failed</p>}
          </CardContent>
        </Card>
      </div>

      {/* Delivery Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("deliveryOrders")} ({trip.deliveryOrders.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {trip.deliveryOrders.map((dOrder, idx) => (
            <div key={dOrder.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">{idx + 1}</span>
                  <div>
                    <p className="font-mono text-sm font-medium">{dOrder.doNumber}</p>
                    <p className="text-xs text-muted-foreground">SO: {dOrder.salesOrder.soNumber}</p>
                  </div>
                </div>
                <Badge variant={deliveryStatusColor[dOrder.deliveryStatus] as "default" | "secondary" | "destructive" | "outline"}>
                  <span className="flex items-center gap-1">
                    {deliveryStatusIcons[dOrder.deliveryStatus]}
                    {deliveryStatusLabel[dOrder.deliveryStatus]}
                  </span>
                </Badge>
              </div>

              <div className="mt-3 flex items-start gap-2">
                <MapPin size={12} className="mt-0.5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{dOrder.salesOrder.customer.name}</p>
                  {dOrder.salesOrder.customer.address && (
                    <p className="text-xs text-muted-foreground">{dOrder.salesOrder.customer.address}</p>
                  )}
                  {dOrder.salesOrder.customer.gpsLatitude && dOrder.salesOrder.customer.gpsLongitude && (
                    <a
                      href={`https://maps.google.com/?q=${dOrder.salesOrder.customer.gpsLatitude},${dOrder.salesOrder.customer.gpsLongitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline"
                    >
                      Open in Maps
                    </a>
                  )}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {dOrder.lines.map((line) => (
                  <Badge key={line.id} variant="outline" className="text-xs">
                    {line.productName} × {line.qtyDelivered} {line.uom}
                  </Badge>
                ))}
              </div>

              {dOrder.deliveryStatus === "FAILED" && dOrder.failureReason && (
                <div className="mt-2 rounded bg-destructive/10 p-2 text-xs text-destructive">
                  {failureReasonLabel[dOrder.failureReason]}
                  {dOrder.failureNote && <span className="ml-1">— {dOrder.failureNote}</span>}
                </div>
              )}

              {dOrder.proofPhotoUrl && (
                <div className="mt-2">
                  <button
                    className="text-xs text-primary underline"
                    onClick={() => setProofPhoto(dOrder.proofPhotoUrl)}
                  >
                    {td("viewProof")}
                  </button>
                  {dOrder.deliveredAt && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {format(new Date(dOrder.deliveredAt), "HH:mm")}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Action Confirm Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction === "start" ? t("startTrip") : t("completeTrip")}</DialogTitle>
            <DialogDescription>
              {confirmAction === "start" ? t("confirmStart") : t("confirmComplete")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>{tc("cancel")}</Button>
            <Button onClick={handleAction} disabled={actionLoading}>
              {actionLoading ? tc("loading") : tc("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proof Photo Viewer */}
      <Dialog open={!!proofPhoto} onOpenChange={() => setProofPhoto(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{td("proofPhoto")}</DialogTitle>
          </DialogHeader>
          {proofPhoto && (
            <div className="relative h-80 w-full">
              <Image src={proofPhoto} alt="Proof" fill className="rounded object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
