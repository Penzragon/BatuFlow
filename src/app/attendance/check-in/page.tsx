"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function AttendanceCheckInPage() {
  const [status, setStatus] = useState<{ checkedIn: boolean; checkedOut: boolean } | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const router = useRouter();

  const refreshStatus = async () => {
    const res = await fetch("/api/attendance/gate-status", { cache: "no-store" });
    const json = await res.json();
    if (json.success) {
      setStatus({ checkedIn: json.data.checkedIn, checkedOut: json.data.checkedOut });
      if (json.data.checkedIn) {
        setTimeout(() => router.push("/dashboard"), 500);
      }
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  const captureGps = async () => {
    if (!("geolocation" in navigator)) return toast.error("Geolocation not available");
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => toast.error("Failed to capture GPS"),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      toast.error("Failed to open camera");
    }
  };

  const takeSelfie = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setSelfie(canvas.toDataURL("image/jpeg", 0.9));
  };

  const submit = async (type: "clock-in" | "clock-out") => {
    if (!gps) return toast.error("GPS is required");
    if (!selfie) return toast.error("Selfie is required");

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("latitude", String(gps.lat));
      fd.append("longitude", String(gps.lng));
      if (gps.accuracy != null) fd.append("accuracy", String(gps.accuracy));
      const blob = await (await fetch(selfie)).blob();
      fd.append("selfie", blob, `${type}.jpg`);

      const res = await fetch(`/api/attendance/${type}`, { method: "POST", body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Action failed");
      toast.success(type === "clock-in" ? "Check-in successful" : "Check-out successful");
      setSelfie(null);
      await refreshStatus();
      if (type === "clock-in") router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md p-6">
      <Card>
        <CardHeader><CardTitle>Attendance Check-in</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Check-in is required before accessing BatuFlow.</p>
          <div className="space-y-2 text-sm">
            <p>Checked in: {status?.checkedIn ? "Yes" : "No"}</p>
            <p>Checked out: {status?.checkedOut ? "Yes" : "No"}</p>
          </div>

          <div className="space-y-2">
            <Button variant="outline" onClick={captureGps}>Capture GPS</Button>
            <p className="text-xs text-muted-foreground">{gps ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}` : "GPS not captured"}</p>
          </div>

          <div className="space-y-2">
            <video ref={videoRef} autoPlay muted playsInline className="w-full rounded border" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={startCamera}>Open Camera</Button>
              <Button variant="outline" onClick={takeSelfie}>Take Selfie</Button>
            </div>
            {selfie && <img src={selfie} alt="selfie" className="rounded border" />}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button disabled={loading || status?.checkedIn} onClick={() => submit("clock-in")}>Check-in</Button>
            <Button disabled={loading || !status?.checkedIn || status?.checkedOut} variant="secondary" onClick={() => submit("clock-out")}>Check-out</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
