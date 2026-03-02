"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, MapPin, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface CustomerOption {
  id: string;
  name: string;
  address: string | null;
}

export default function SalesVisitCheckInForm({
  customers,
  initialCustomerId,
}: {
  customers: CustomerOption[];
  initialCustomerId?: string;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [notes, setNotes] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [selfieData, setSelfieData] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId),
    [customers, customerId]
  );

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
      setCameraOn(true);
    } catch {
      toast.error("Could not access camera");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
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
    setSelfieData(canvas.toDataURL("image/jpeg", 0.85));
    stopCamera();
  };

  const captureGps = () => {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGpsLoading(false);
      },
      () => {
        toast.error("Could not get GPS location");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    captureGps();
    return () => stopCamera();
  }, []);

  const handleSubmit = async () => {
    if (!customerId) return toast.error("Please select customer");
    if (!gps) return toast.error("GPS is required");
    if (!selfieData) return toast.error("Photo is required");

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
        throw new Error(json.error || "Failed check-in");
      }

      toast.success("Check-in success");
      router.push("/sales/dashboard");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-lg font-semibold">Visit Check-in</h1>
        <p className="text-xs text-muted-foreground">Photo + GPS + timestamp will be recorded</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Customer</label>
        <select
          className="w-full rounded-md border bg-background p-2 text-sm"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        >
          <option value="">Select customer</option>
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
          <p className="text-sm font-medium">GPS</p>
          <button
            type="button"
            onClick={captureGps}
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent"
          >
            <RotateCcw size={12} /> Refresh
          </button>
        </div>
        {gpsLoading ? (
          <p className="text-xs text-muted-foreground">Getting GPS...</p>
        ) : gps ? (
          <div className="space-y-1 text-xs">
            <p className="inline-flex items-center gap-1"><MapPin size={12} /> {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}</p>
            <p className="text-muted-foreground">Accuracy: ±{Math.round(gps.accuracy)} m</p>
          </div>
        ) : (
          <p className="text-xs text-red-600">GPS not captured yet</p>
        )}
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm font-medium">Selfie Photo</p>
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
                  className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  <Camera size={14} /> Start Camera
                </button>
              ) : (
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                >
                  <Camera size={14} /> Capture
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <img src={selfieData} alt="Selfie preview" className="w-full rounded-md border object-cover" />
            <button
              type="button"
              onClick={() => {
                setSelfieData(null);
                startCamera();
              }}
              className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-sm hover:bg-accent"
            >
              <RotateCcw size={14} /> Retake
            </button>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Notes (optional)</label>
        <textarea
          className="min-h-20 w-full rounded-md border bg-background p-2 text-sm"
          placeholder="Extra notes from customer visit"
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
        {submitting ? "Submitting..." : "Submit Check-in"}
      </button>
    </div>
  );
}
