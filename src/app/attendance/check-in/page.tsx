"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Camera, MapPin, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { dataUrlToBlob, drawPhotoCaptionBar, formatPhotoCaptionTimestamp } from "@/lib/client-photo-watermark";

interface GateStatus {
  hasEmployee: boolean;
  employeeId?: string;
  employeeName?: string;
  checkedIn: boolean;
  checkedOut: boolean;
}

export default function AttendanceCheckInPage() {
  const t = useTranslations("attendance.gate");
  const tSalesGps = useTranslations("salesMobile.visits.gps");
  const [gate, setGate] = useState<GateStatus | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [selfieData, setSelfieData] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** Selected action before photo capture so the watermark matches the submission. */
  const [pendingClock, setPendingClock] = useState<"clock-in" | "clock-out" | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextAfterCheckInRaw = searchParams.get("next");
  const nextAfterCheckIn =
    nextAfterCheckInRaw &&
    nextAfterCheckInRaw.startsWith("/") &&
    !nextAfterCheckInRaw.startsWith("/attendance/check-in")
      ? nextAfterCheckInRaw
      : "/dashboard";

  const refreshStatus = useCallback(async () => {
    const res = await fetch("/api/attendance/gate-status", { cache: "no-store" });
    const json = await res.json();
    if (json.success) {
      const data = json.data as GateStatus;
      setGate(data);
      if (data.checkedIn && data.checkedOut) {
        setTimeout(() => router.push("/dashboard"), 500);
      }
    }
  }, [router]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((tr) => tr.stop()), []);

  const captureGps = () => {
    if (!("geolocation" in navigator)) {
      toast.error(t("errors.geolocation"));
      return;
    }
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
              : t("errors.gpsFailed");
        setGpsError(actionableMessage);
        toast.error(actionableMessage);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  useEffect(() => {
    captureGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount for gate flow
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const startCamera = async () => {
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
          : t("errors.cameraFailed");
      setCameraError(actionableMessage);
      toast.error(actionableMessage);
    }
  };

  const capturePhoto = () => {
    if (!pendingClock) return;
    const clockKind = pendingClock;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    const wm =
      clockKind === "clock-in" ? t("watermarkIn") : t("watermarkOut");
    const namePart = (gate?.employeeName ?? "STAFF").slice(0, 26);
    drawPhotoCaptionBar(ctx, canvas, {
      line1: `ATTENDANCE | ${namePart} | ${wm}`,
      line2: formatPhotoCaptionTimestamp(),
      variant: "standard",
    });

    setSelfieData(canvas.toDataURL("image/jpeg", 0.9));
    stopCamera();
  };

  const submit = async (type: "clock-in" | "clock-out") => {
    if (!gps) {
      toast.error(t("errors.gpsRequired"));
      return;
    }
    if (!selfieData) {
      toast.error(t("errors.photoRequired"));
      return;
    }

    setLoading(true);
    try {
      const blob = dataUrlToBlob(selfieData);
      if (blob.size === 0) {
        throw new Error(t("errors.photoRequired"));
      }

      const fd = new FormData();
      fd.append("latitude", String(gps.lat));
      fd.append("longitude", String(gps.lng));
      fd.append("accuracy", String(gps.accuracy));
      fd.append("selfie", blob, `${type}.jpg`);

      const res = await fetch(`/api/attendance/${type}`, { method: "POST", body: fd });
      const raw = await res.text();
      let json: { success?: boolean; error?: string } = {};
      try {
        json = JSON.parse(raw) as typeof json;
      } catch {
        throw new Error(raw.slice(0, 200) || t("errors.actionFailed"));
      }
      if (!res.ok || !json.success) throw new Error(json.error || t("errors.actionFailed"));
      toast.success(type === "clock-in" ? t("successClockIn") : t("successClockOut"));
      setSelfieData(null);
      await refreshStatus();
      if (type === "clock-in") router.push(nextAfterCheckIn);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.actionFailed"));
    } finally {
      setLoading(false);
    }
  };

  const gpsAccuracyWarningThreshold = 50;
  const isGpsAccuracyLow = gps ? gps.accuracy > gpsAccuracyWarningThreshold : false;

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div>
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </div>

      {!gate && <p className="text-sm text-muted-foreground">{t("loading")}</p>}

      {gate && !gate.hasEmployee && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("noEmployee")}
        </div>
      )}

      {gate && gate.hasEmployee && (
        <Card>
          <CardContent className="space-y-4 pt-6 text-sm">
            <div className="flex gap-6 text-muted-foreground">
              <span>
                {t("checkedInLabel")}:{" "}
                <span className="font-medium text-foreground">
                  {gate ? (gate.checkedIn ? t("yes") : t("no")) : "…"}
                </span>
              </span>
              <span>
                {t("checkedOutLabel")}:{" "}
                <span className="font-medium text-foreground">
                  {gate ? (gate.checkedOut ? t("yes") : t("no")) : "…"}
                </span>
              </span>
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
                  <p className="inline-flex items-center gap-1">
                    <MapPin size={12} /> {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
                  </p>
                  <p className="text-muted-foreground">{tSalesGps("accuracy", { meters: Math.round(gps.accuracy) })}</p>
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

            <div className="space-y-2">
              <p className="text-sm font-medium">{t("photo.title")}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={pendingClock === "clock-in" ? "default" : "outline"}
                  size="sm"
                  disabled={Boolean(gate?.checkedIn)}
                  onClick={() => {
                    setPendingClock("clock-in");
                    setSelfieData(null);
                    stopCamera();
                  }}
                >
                  {t("clockIn")}
                </Button>
                <Button
                  type="button"
                  variant={pendingClock === "clock-out" ? "default" : "outline"}
                  size="sm"
                  disabled={!gate?.checkedIn || Boolean(gate?.checkedOut)}
                  onClick={() => {
                    setPendingClock("clock-out");
                    setSelfieData(null);
                    stopCamera();
                  }}
                >
                  {t("clockOut")}
                </Button>
              </div>
              {!pendingClock && (
                <p className="text-xs text-muted-foreground">{t("photo.selectActionFirst")}</p>
              )}
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              {!selfieData ? (
                <>
                  <div className="overflow-hidden rounded-md bg-black/80">
                    <video ref={videoRef} className="h-56 w-full object-cover" playsInline muted />
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex flex-wrap gap-2">
                    {!cameraOn ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!pendingClock}
                        onClick={() => void startCamera()}
                      >
                        <Camera className="mr-1 size-4" />
                        {cameraError ? t("photo.retryCamera") : t("photo.startCamera")}
                      </Button>
                    ) : (
                      <Button type="button" size="sm" onClick={capturePhoto}>
                        <Camera className="mr-1 size-4" />
                        {t("photo.capture")}
                      </Button>
                    )}
                  </div>
                  {cameraError && <p className="text-xs text-red-600">{cameraError}</p>}
                  {pendingClock && !cameraOn && !cameraError && (
                    <p className="text-xs text-muted-foreground">{t("photo.retryHint")}</p>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview */}
                  <img src={selfieData} alt={t("photo.previewAlt")} className="w-full rounded-md border object-cover" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelfieData(null);
                      void startCamera();
                    }}
                  >
                    <RotateCcw className="mr-1 size-4" />
                    {t("photo.retake")}
                  </Button>
                  <Button
                    className="w-full"
                    disabled={loading || !pendingClock || !gate?.hasEmployee}
                    onClick={() => pendingClock && void submit(pendingClock)}
                  >
                    {pendingClock === "clock-out" ? t("clockOut") : t("clockIn")}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
