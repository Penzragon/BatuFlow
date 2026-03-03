"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Camera, MapPin, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type VisitProps = {
  id: string;
  customerName: string;
  customerAddress: string | null;
  checkInAt: string;
  status: string;
  checkoutAt: string | null;
};

type CheckoutSummary = {
  status?: string;
  checkoutAt?: string | null;
  durationMinutes?: number | null;
};

const GPS_REASON_CODES = ["GPS_DENIED", "GPS_TIMEOUT", "DEVICE_ERROR", "NO_SIGNAL"] as const;

export default function SalesVisitCheckoutForm({ visit }: { visit: VisitProps }) {
  const t = useTranslations("salesMobile.visits.checkout");
  const router = useRouter();
  const locale = useLocale();

  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsReasonCode, setGpsReasonCode] = useState<(typeof GPS_REASON_CODES)[number] | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<CheckoutSummary | null>(
    visit.checkoutAt
      ? {
          status: visit.status,
          checkoutAt: visit.checkoutAt,
          durationMinutes: Math.max(
            0,
            Math.round((new Date(visit.checkoutAt).getTime() - new Date(visit.checkInAt).getTime()) / 60000)
          ),
        }
      : null
  );

  const photoPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);

  const captureGps = () => {
    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGpsReasonCode("");
        setGpsError(null);
        setGpsLoading(false);
      },
      (err) => {
        const actionableMessage =
          err.code === err.PERMISSION_DENIED
            ? t("errors.gpsPermission")
            : err.code === err.TIMEOUT
              ? t("errors.gpsTimeout")
              : t("errors.gpsCapture");
        setGpsError(actionableMessage);
        setGps(null);
        toast.error(actionableMessage);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const mapApiError = (message: string) => {
    if (message.includes("already checked out")) return t("errors.alreadyCheckedOut");
    if (message.includes("GPS reason code is required")) return t("errors.gpsReasonRequired");
    if (message.includes("Invalid gpsReasonCode")) return t("errors.invalidGpsReason");
    if (message.includes("Invalid photo format")) return t("errors.invalidPhotoType");
    if (message.includes("Photo must be 1 MB or smaller")) return t("errors.photoTooLarge");
    if (message.includes("Forbidden")) return t("unauthorized");
    if (message.includes("Visit not found")) return t("notFound");
    return t("errors.failedCheckout");
  };

  const handleSubmit = async () => {
    if (visit.checkoutAt || summary?.checkoutAt) {
      return toast.error(t("errors.alreadyCheckedOut"));
    }

    if (!gps && !gpsReasonCode) {
      return toast.error(t("errors.gpsReasonRequired"));
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      if (gps) {
        formData.append("gpsLatitude", String(gps.lat));
        formData.append("gpsLongitude", String(gps.lng));
        formData.append("gpsAccuracy", String(gps.accuracy));
      } else if (gpsReasonCode) {
        formData.append("gpsReasonCode", gpsReasonCode);
      }

      if (notes.trim()) formData.append("notes", notes.trim());
      if (photo) formData.append("photo", photo);

      const res = await fetch(`/api/visits/${visit.id}/check-out`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || "checkout_failed");
      }

      const nextSummary = {
        status: json.data?.status,
        checkoutAt: json.data?.checkoutAt,
        durationMinutes: json.data?.durationMinutes,
      } as CheckoutSummary;

      setSummary(nextSummary);
      toast.success(t("success"));
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "checkout_failed";
      toast.error(mapApiError(message));
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDateTime = (iso?: string | null) => {
    if (!iso) return "-";
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="rounded-lg border p-3">
        <p className="text-sm font-medium">{visit.customerName}</p>
        {visit.customerAddress && <p className="text-xs text-muted-foreground">{visit.customerAddress}</p>}
        <p className="mt-1 text-xs text-muted-foreground">{t("checkInAt", { at: fmtDateTime(visit.checkInAt) })}</p>
      </div>

      {summary && (
        <div className="space-y-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
          <p className="text-sm font-semibold text-emerald-900">{t("summary.title")}</p>
          <p className="text-xs text-emerald-900">{t("summary.status", { status: summary.status ?? "-" })}</p>
          <p className="text-xs text-emerald-900">{t("summary.checkOutAt", { at: fmtDateTime(summary.checkoutAt ?? null) })}</p>
          {summary.durationMinutes != null && (
            <p className="text-xs text-emerald-900">{t("summary.duration", { minutes: summary.durationMinutes })}</p>
          )}
          <Link href="/sales-mobile/dashboard" className="inline-flex rounded border border-emerald-400 bg-white px-3 py-1 text-xs hover:bg-emerald-100">
            {t("summary.backToDashboard")}
          </Link>
        </div>
      )}

      {!summary && (
        <>
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{t("gps.title")}</p>
              <button
                type="button"
                onClick={captureGps}
                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent"
              >
                <RotateCcw size={12} /> {gpsError ? t("gps.retry") : t("gps.refresh")}
              </button>
            </div>

            {gpsLoading ? (
              <p className="text-xs text-muted-foreground">{t("gps.loading")}</p>
            ) : gps ? (
              <div className="space-y-1 text-xs">
                <p className="inline-flex items-center gap-1"><MapPin size={12} /> {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}</p>
                <p className="text-muted-foreground">{t("gps.accuracy", { meters: Math.round(gps.accuracy) })}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-red-600">{t("gps.notCaptured")}</p>
                {gpsError && <p className="text-xs text-red-600">{gpsError}</p>}
                <p className="text-xs text-muted-foreground">{t("gps.reasonLabel")}</p>
                <select
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={gpsReasonCode}
                  onChange={(e) => setGpsReasonCode(e.target.value as (typeof GPS_REASON_CODES)[number] | "")}
                >
                  <option value="">{t("gps.reasonPlaceholder")}</option>
                  {GPS_REASON_CODES.map((code) => (
                    <option key={code} value={code}>
                      {t(`gps.reasons.${code}`)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <label className="text-sm font-medium">{t("photo.title")}</label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded border px-3 py-1.5 text-sm hover:bg-accent">
              <Camera size={14} /> {t("photo.pick")}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
            </label>
            {photo && <p className="text-xs text-muted-foreground">{photo.name}</p>}
            {photoPreview && <img src={photoPreview} alt={t("photo.previewAlt")} className="max-h-56 w-full rounded-md border object-contain" />}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t("notesLabel")}</label>
            <textarea
              className="min-h-20 w-full rounded-md border bg-background p-2 text-sm"
              placeholder={t("notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {submitting ? t("submitting") : t("submit")}
          </button>
        </>
      )}
    </div>
  );
}
