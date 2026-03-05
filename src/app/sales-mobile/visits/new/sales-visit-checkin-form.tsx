"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Camera, MapPin, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface CustomerOption {
  id: string;
  name: string;
  address: string | null;
}

type VisitDraft = {
  version: 1;
  customerId: string;
  notes: string;
  selfieData: string | null;
};

const VISIT_DRAFT_KEY = "batuflow:sales-mobile:visit-checkin-draft:v1";

export default function SalesVisitCheckInForm({
  customers,
  initialCustomerId,
}: {
  customers: CustomerOption[];
  initialCustomerId?: string;
}) {
  const t = useTranslations("salesMobile.visits");
  const router = useRouter();
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [notes, setNotes] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [selfieData, setSelfieData] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSaveFailed, setDraftSaveFailed] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSaveErrorNotifiedRef = useRef(false);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId),
    [customers, customerId]
  );

  const clearDraft = () => {
    try {
      localStorage.removeItem(VISIT_DRAFT_KEY);
    } catch {
      // no-op
    }
    setCustomerId(initialCustomerId ?? "");
    setNotes("");
    setSelfieData(null);
    setDraftRestored(false);
    toast.success(t("draft.cleared"));
  };

  const startCamera = async () => {
    if (!customerId) {
      toast.error(t("errors.customerRequired"));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraError(null);
      setCameraOn(true);
    } catch (err) {
      const actionableMessage =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? t("errors.cameraPermission")
          : t("errors.cameraAccess");
      setCameraError(actionableMessage);
      toast.error(actionableMessage);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);

    // Client-side watermark to avoid server font rendering issues.
    const ts = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())} ${pad(ts.getHours())}:${pad(ts.getMinutes())} WIB`;
    const customerLabel = (selectedCustomer?.name || "CUSTOMER").slice(0, 28);
    const line1 = `VISIT | ${customerLabel}`;
    const line2 = stamp;

    const barH = Math.max(42, Math.round(canvas.height * 0.14));
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(0, canvas.height - barH, canvas.width, barH);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = `${Math.max(14, Math.round(canvas.width * 0.034))}px Arial, sans-serif`;
    ctx.fillText(line1, 10, canvas.height - Math.round(barH * 0.58));

    ctx.fillStyle = "#FFD700";
    ctx.font = `${Math.max(12, Math.round(canvas.width * 0.027))}px Arial, sans-serif`;
    ctx.fillText(line2, 10, canvas.height - Math.round(barH * 0.18));

    setSelfieData(canvas.toDataURL("image/jpeg", 0.85));
    stopCamera();
  };

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
        toast.error(actionableMessage);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    captureGps();
    return () => {
      stopCamera();
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VISIT_DRAFT_KEY);
      if (!raw) {
        setDraftReady(true);
        return;
      }

      const parsed = JSON.parse(raw) as VisitDraft;
      if (parsed.version !== 1) {
        setDraftReady(true);
        return;
      }

      setCustomerId((prev) => prev || parsed.customerId || "");
      setNotes(parsed.notes || "");
      setSelfieData(parsed.selfieData || null);
      setDraftRestored(Boolean(parsed.customerId || parsed.notes || parsed.selfieData));
    } catch {
      // ignore invalid draft format
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);

    draftSaveTimerRef.current = setTimeout(() => {
      const draft: VisitDraft = {
        version: 1,
        customerId,
        notes,
        selfieData,
      };
      try {
        localStorage.setItem(VISIT_DRAFT_KEY, JSON.stringify(draft));
        if (draftSaveFailed) {
          setDraftSaveFailed(false);
        }
        draftSaveErrorNotifiedRef.current = false;
      } catch {
        setDraftSaveFailed(true);
        if (!draftSaveErrorNotifiedRef.current) {
          toast.error(t("draft.saveFailed"));
          draftSaveErrorNotifiedRef.current = true;
        }
      }
    }, 350);
  }, [customerId, notes, selfieData, draftReady, draftSaveFailed, t]);

  const gpsAccuracyWarningThreshold = 50;
  const isGpsAccuracyLow = gps ? gps.accuracy > gpsAccuracyWarningThreshold : false;

  const handleSubmit = async () => {
    if (!customerId) return toast.error(t("errors.customerRequired"));
    if (!gps) return toast.error(t("errors.gpsRequired"));
    if (!selfieData) return toast.error(t("errors.photoRequired"));

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("customerId", customerId);
      formData.append("gpsLatitude", String(gps.lat));
      formData.append("gpsLongitude", String(gps.lng));
      formData.append("gpsAccuracy", String(gps.accuracy));
      if (notes.trim()) formData.append("notes", notes.trim());

      const blob = await (await fetch(selfieData)).blob();
      formData.append("selfie", blob, "checkin.jpg");

      const res = await fetch("/api/visits/check-in", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || t("errors.failedCheckIn"));
      }

      try {
        localStorage.removeItem(VISIT_DRAFT_KEY);
      } catch {
        // no-op
      }
      toast.success(t("success"));
      router.push("/sales-mobile/dashboard");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.failedCheckIn"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </div>

      {draftRestored && (
        <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span>{t("draft.restored")}</span>
          <button
            type="button"
            onClick={clearDraft}
            className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-1 hover:bg-amber-100"
          >
            <Trash2 size={12} /> {t("draft.clear")}
          </button>
        </div>
      )}

      {draftSaveFailed && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {t("draft.saveFailed")}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">{t("customerLabel")}</label>
        <select
          className="w-full rounded-md border bg-background p-2 text-sm"
          value={customerId}
          onChange={(e) => {
            const nextCustomerId = e.target.value;
            if (nextCustomerId !== customerId && selfieData) {
              setSelfieData(null);
            }
            setCustomerId(nextCustomerId);
          }}
        >
          <option value="">{t("customerPlaceholder")}</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {selectedCustomer?.address && (
          <p className="text-xs text-muted-foreground">{selectedCustomer.address}</p>
        )}
      </div>

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
            {isGpsAccuracyLow && (
              <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                {t("gps.softAccuracyWarning", { meters: Math.round(gps.accuracy) })}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-red-600">{t("gps.notCaptured")}</p>
            {gpsError && <p className="text-xs text-red-600">{gpsError}</p>}
            <p className="text-xs text-muted-foreground">{t("gps.retryHint")}</p>
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm font-medium">{t("photo.title")}</p>
        {!selfieData ? (
          <>
            <div className="overflow-hidden rounded-md bg-black/80">
              <video ref={videoRef} className="h-56 w-full object-cover" playsInline muted />
            </div>
            <div className="flex gap-2">
              {!cameraOn ? (
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={!customerId}
                  className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Camera size={14} /> {cameraError ? t("photo.retryCamera") : t("photo.startCamera")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                >
                  <Camera size={14} /> {t("photo.capture")}
                </button>
              )}
            </div>
            {cameraError && <p className="text-xs text-red-600">{cameraError}</p>}
            {!customerId && <p className="text-xs text-amber-700">{t("errors.customerRequired")}</p>}
            {!cameraOn && !cameraError && customerId && <p className="text-xs text-muted-foreground">{t("photo.retryHint")}</p>}
          </>
        ) : (
          <div className="space-y-2">
            <img src={selfieData} alt={t("photo.previewAlt")} className="w-full rounded-md border object-cover" />
            <button
              type="button"
              onClick={() => {
                setSelfieData(null);
                startCamera();
              }}
              className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-sm hover:bg-accent"
            >
              <RotateCcw size={14} /> {t("photo.retake")}
            </button>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
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
    </div>
  );
}
