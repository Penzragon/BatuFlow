"use client";

import { useEffect, useState, useCallback, useRef, ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowLeft, Truck, MapPin, Package, Camera, CheckCircle,
  XCircle, ExternalLink, Loader2, LocateFixed
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import Image from "next/image";

interface DOLine { id: string; productName: string; qtyDelivered: number; uom: string }
interface DeliveryOrderDetail {
  id: string;
  doNumber: string;
  deliveryStatus: "PENDING" | "PICKED_UP" | "ON_THE_WAY" | "DELIVERED" | "FAILED";
  deliveredAt: string | null;
  failureReason: string | null;
  failureNote: string | null;
  proofPhotoUrl: string | null;
  salesOrder: {
    soNumber: string;
    customer: { name: string; address: string | null; phone: string | null; gpsLatitude: number | null; gpsLongitude: number | null };
  };
  lines: DOLine[];
  trip: { id: string; status: string };
}

const FAILURE_REASON_KEYS = [
  { value: "CUSTOMER_ABSENT", key: "customerAbsent" },
  { value: "WRONG_ADDRESS", key: "wrongAddress" },
  { value: "CUSTOMER_REFUSED", key: "customerRefused" },
  { value: "OTHER", key: "other" },
] as const;

export default function DODeliveryActionPage() {
  const t = useTranslations("driver");
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;
  const doId = params.doId as string;

  const [dOrder, setDOrder] = useState<DeliveryOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Camera / proof photo state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);

  // GPS state
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Failure state
  const [showFailureForm, setShowFailureForm] = useState(false);
  const [failureReason, setFailureReason] = useState("");
  const [failureNote, setFailureNote] = useState("");

  const fetchDO = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      const data = await res.json();
      if (data.success) {
        const found = data.data.deliveryOrders.find((d: DeliveryOrderDetail) => d.id === doId);
        if (found) {
          setDOrder({ ...found, trip: { id: tripId, status: data.data.status } });
        } else {
          toast.error(t("deliveryOrderNotFound"));
          router.push(`/driver/trips/${tripId}`);
        }
      }
    } catch {
      toast.error(t("failedToLoadDelivery"));
    } finally {
      setLoading(false);
    }
  }, [doId, tripId, router]);

  useEffect(() => { fetchDO(); }, [fetchDO]);

  const captureGPS = () => {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
        toast.success("GPS captured");
      },
      () => {
        setGpsLoading(false);
        toast.error("Could not capture GPS location");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const startCamera = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoBlob(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setCapturedPhoto(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setPhotoBlob(null);
    fileInputRef.current?.click();
  };

  const handleUpdateStatus = async (newStatus: "PICKED_UP" | "ON_THE_WAY") => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/driver/dos/${doId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryStatus: newStatus }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Status updated");
      router.push(`/driver/trips/${tripId}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelivered = async () => {
    if (!photoBlob) {
      toast.error("Proof photo is required");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("photo", photoBlob, "proof.jpg");
      if (gps) {
        formData.append("gpsLatitude", String(gps.lat));
        formData.append("gpsLongitude", String(gps.lng));
      }

      const res = await fetch(`/api/driver/dos/${doId}/proof`, { method: "POST", body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Delivered! Proof photo uploaded.");
      router.push(`/driver/trips/${tripId}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFailed = async () => {
    if (!failureReason) {
      toast.error("Please select a failure reason");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/driver/dos/${doId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryStatus: "FAILED",
          failureReason,
          failureNote: failureNote || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Marked as failed");
      router.push(`/driver/trips/${tripId}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dOrder) return null;

  const customer = dOrder.salesOrder.customer;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/driver/trips/${tripId}`} className="rounded-full p-1 hover:bg-muted">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="font-bold">{customer.name}</h1>
          <p className="text-xs text-muted-foreground font-mono">{dOrder.doNumber}</p>
        </div>
      </div>

      {/* Customer info */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <MapPin size={18} className="mt-0.5 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="font-medium">{customer.name}</p>
            {customer.address && <p className="text-sm text-muted-foreground">{customer.address}</p>}
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="mt-0.5 block text-xs text-primary">
                {customer.phone}
              </a>
            )}
            {customer.gpsLatitude && customer.gpsLongitude && (
              <a
                href={`https://maps.google.com/?q=${customer.gpsLatitude},${customer.gpsLongitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-center gap-1 text-xs text-primary"
              >
                <MapPin size={10} />
                {t("openMaps")}
                <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Package size={14} className="text-muted-foreground" />
          <span className="text-sm font-semibold">{t("items")}</span>
        </div>
        <div className="space-y-1">
          {dOrder.lines.map((line) => (
            <div key={line.id} className="flex items-center justify-between text-sm">
              <span>{line.productName}</span>
              <span className="font-medium">{line.qtyDelivered} {line.uom}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons based on current status */}
      {dOrder.deliveryStatus === "PENDING" && (
        <button
          onClick={() => handleUpdateStatus("PICKED_UP")}
          disabled={submitting}
          className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-blue-500 text-white font-semibold text-lg disabled:opacity-50"
        >
          {submitting ? <Loader2 size={20} className="animate-spin" /> : <Package size={20} />}
          {t("markPickedUp")}
        </button>
      )}

      {dOrder.deliveryStatus === "PICKED_UP" && (
        <button
          onClick={() => handleUpdateStatus("ON_THE_WAY")}
          disabled={submitting}
          className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-white font-semibold text-lg disabled:opacity-50"
        >
          {submitting ? <Loader2 size={20} className="animate-spin" /> : <Truck size={20} />}
          {t("markOnTheWay")}
        </button>
      )}

      {dOrder.deliveryStatus === "ON_THE_WAY" && !showFailureForm && (
        <>
          {/* GPS Capture */}
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">GPS Location</p>
                {gps ? (
                  <p className="text-xs text-green-600">{gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Not captured yet</p>
                )}
              </div>
              <button
                onClick={captureGPS}
                disabled={gpsLoading}
                className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                {gpsLoading ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />}
                Capture GPS
              </button>
            </div>
          </div>

          {/* Camera / Photo */}
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold">Proof Photo <span className="text-red-500">*</span></p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            {!capturedPhoto && (
              <button
                onClick={startCamera}
                className="flex min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Camera size={32} />
                <span className="text-sm">Tap to open camera</span>
              </button>
            )}
            {capturedPhoto && (
              <div className="space-y-2">
                <div className="relative h-48 w-full overflow-hidden rounded-xl">
                  <Image src={capturedPhoto} alt="Proof" fill className="object-cover" />
                </div>
                <button
                  onClick={retakePhoto}
                  className="w-full rounded-lg border py-2 text-sm text-muted-foreground hover:bg-muted"
                >
                  Retake Photo
                </button>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleDelivered}
              disabled={submitting || !photoBlob}
              className="flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 text-white font-semibold text-base disabled:opacity-50"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
              {t("delivered")}
            </button>
            <button
              onClick={() => setShowFailureForm(true)}
              disabled={submitting}
              className="flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-xl border border-destructive text-destructive font-semibold text-base disabled:opacity-50"
            >
              <XCircle size={18} />
              {t("failed")}
            </button>
          </div>
        </>
      )}

      {/* Failure form */}
      {showFailureForm && dOrder.deliveryStatus === "ON_THE_WAY" && (
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-destructive">{t("markAsFailed")}</h2>
            <button onClick={() => setShowFailureForm(false)} className="text-xs text-muted-foreground underline">{t("cancel")}</button>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{t("reason")} <span className="text-red-500">*</span></p>
            <div className="space-y-2">
              {FAILURE_REASON_KEYS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setFailureReason(r.value)}
                  className={`w-full rounded-xl border p-3 text-left text-sm transition-colors ${failureReason === r.value ? "border-destructive bg-red-50 text-destructive font-medium" : "hover:bg-muted"}`}
                >
                  {t(r.key)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">{t("addNote")}</p>
            <textarea
              value={failureNote}
              onChange={(e) => setFailureNote(e.target.value)}
              rows={3}
              className="w-full rounded-xl border p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-destructive/50"
              placeholder="Add additional notes..."
            />
          </div>
          <button
            onClick={handleFailed}
            disabled={submitting || !failureReason}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-destructive text-destructive-foreground font-semibold text-base disabled:opacity-50"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />}
            {t("confirmFailed")}
          </button>
        </div>
      )}

      {/* Already delivered / failed */}
      {dOrder.deliveryStatus === "DELIVERED" && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <CheckCircle size={32} className="mx-auto text-green-500" />
          <p className="mt-2 font-bold text-green-700">{t("deliveryCompleted")}</p>
          {dOrder.deliveredAt && (
            <p className="text-sm text-green-600">{format(new Date(dOrder.deliveredAt), "HH:mm, dd MMM yyyy")}</p>
          )}
          {dOrder.proofPhotoUrl && (
            <div className="mt-3">
              <div className="relative h-40 w-full overflow-hidden rounded-xl">
                <Image src={dOrder.proofPhotoUrl} alt="Proof" fill className="object-cover" />
              </div>
            </div>
          )}
        </div>
      )}

      {dOrder.deliveryStatus === "FAILED" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <XCircle size={32} className="mx-auto text-red-500" />
          <p className="mt-2 font-bold text-red-700">{t("deliveryFailed")}</p>
          {dOrder.failureReason && (
            <p className="text-sm text-red-600">{dOrder.failureReason.replace("_", " ")}</p>
          )}
          {dOrder.failureNote && (
            <p className="mt-1 text-xs text-red-500">{dOrder.failureNote}</p>
          )}
        </div>
      )}
    </div>
  );
}
