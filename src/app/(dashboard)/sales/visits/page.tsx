"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { ColumnDef } from "@tanstack/react-table";
import { Camera, Eye, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

interface Visit {
  id: string;
  customerId: string;
  customer: { id: string; name: string };
  salesperson: { id: string; name: string };
  status: "OPEN" | "CHECKED_OUT" | "STALE_OPEN";
  selfieUrl: string | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsAccuracy: number | null;
  distanceFromCustomer: number | null;
  checkInAt: string;
  checkoutAt: string | null;
  checkoutLat: number | null;
  checkoutLng: number | null;
  checkoutPhotoPath: string | null;
  expiresAt: string;
  notes: string | null;
  _count: { salesOrders: number };
  lifecycle?: {
    status: "OPEN" | "CHECKED_OUT" | "STALE_OPEN" | null;
    checkoutAt: string | null;
    durationMinutes: number | null;
  };
}

interface Customer {
  id: string;
  name: string;
}

interface Salesperson {
  id: string;
  name: string;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return format(new Date(value), "dd MMM yyyy HH:mm");
}

function formatDuration(minutes?: number | null) {
  if (minutes == null) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function VisitsPage() {
  const t = useTranslations("visits");
  const tc = useTranslations("common");
  const { data: session } = useSession();

  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [notes, setNotes] = useState("");
  const [selfieData, setSelfieData] = useState<string | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [distanceWarning, setDistanceWarning] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [salespersonFilter, setSalespersonFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchVisits = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ pageSize: "100" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (salespersonFilter !== "all") params.set("salespersonId", salespersonFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/visits?${params.toString()}`);
      const json = await res.json();
      if (json.success) setVisits(json.data.items);
    } catch {
      toast.error("Failed to load visits");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, salespersonFilter, dateFrom, dateTo]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/customers?pageSize=200");
      const json = await res.json();
      if (json.success) setCustomers(json.data.items);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchSalespeople = useCallback(async () => {
    if (session?.user?.role === "STAFF") return;

    try {
      const res = await fetch("/api/users?role=STAFF");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) setSalespeople(json.data.items ?? []);
    } catch {
      /* ignore */
    }
  }, [session?.user?.role]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    fetchSalespeople();
  }, [fetchSalespeople]);

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
    } catch {
      toast.error("Could not access camera");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      setSelfieData(canvas.toDataURL("image/jpeg", 0.8));
    }
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
      { enableHighAccuracy: true }
    );
  };

  const openCheckIn = () => {
    setCheckInOpen(true);
    setSelfieData(null);
    setGps(null);
    setSelectedCustomer("");
    setNotes("");
    setDistanceWarning(false);
    setTimeout(() => {
      startCamera();
      captureGps();
    }, 300);
  };

  const closeCheckIn = () => {
    setCheckInOpen(false);
    stopCamera();
  };

  const handleCheckIn = async () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("customerId", selectedCustomer);
      if (gps) {
        formData.append("gpsLatitude", String(gps.lat));
        formData.append("gpsLongitude", String(gps.lng));
        formData.append("gpsAccuracy", String(gps.accuracy));
      }
      if (notes) formData.append("notes", notes);
      if (selfieData) {
        const blob = await (await fetch(selfieData)).blob();
        formData.append("selfie", blob, "selfie.jpg");
      }

      const res = await fetch("/api/visits/check-in", { method: "POST", body: formData });
      const json = await res.json();
      if (json.success) {
        toast.success(t("checkInSuccess"));
        if (json.data.distanceWarning) {
          setDistanceWarning(true);
        }
        closeCheckIn();
        fetchVisits();
      } else {
        toast.error(json.error || "Check-in failed");
      }
    } catch {
      toast.error("Check-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnDef<Visit>[] = useMemo(
    () => [
      {
        id: "status",
        header: t("status"),
        cell: ({ row }) => {
          const status = row.original.lifecycle?.status ?? row.original.status;
          return <StatusBadge status={status} />;
        },
      },
      {
        accessorKey: "checkInAt",
        header: t("checkInAt"),
        cell: ({ row }) => formatDateTime(row.original.checkInAt),
      },
      {
        id: "checkOutAt",
        header: t("checkOutAt"),
        cell: ({ row }) => formatDateTime(row.original.lifecycle?.checkoutAt ?? row.original.checkoutAt),
      },
      {
        id: "duration",
        header: t("duration"),
        cell: ({ row }) => formatDuration(row.original.lifecycle?.durationMinutes),
      },
      {
        accessorKey: "salesperson.name",
        header: t("salesperson"),
        cell: ({ row }) => row.original.salesperson?.name ?? "-",
      },
      {
        accessorKey: "customer.name",
        header: t("customer"),
        cell: ({ row }) => row.original.customer?.name ?? "-",
      },
      {
        id: "gps",
        header: t("gpsLocation"),
        cell: ({ row }) => {
          const { gpsLatitude: lat, gpsLongitude: lng } = row.original;
          return lat && lng ? (
            <span className="text-xs">{lat.toFixed(4)}, {lng.toFixed(4)}</span>
          ) : "-";
        },
      },
      {
        id: "checkoutDetails",
        header: t("checkoutDetails"),
        cell: ({ row }) => {
          const v = row.original;
          const checkoutCoords = v.checkoutLat != null && v.checkoutLng != null
            ? `${v.checkoutLat.toFixed(6)}, ${v.checkoutLng.toFixed(6)}`
            : "-";

          return (
            <div className="space-y-1 text-xs leading-relaxed">
              <div><span className="text-muted-foreground">GPS:</span> {checkoutCoords}</div>
              <div><span className="text-muted-foreground">{t("notes")}:</span> {v.notes || "-"}</div>
              <div>
                <span className="text-muted-foreground">{t("photoPath")}:</span>{" "}
                {v.checkoutPhotoPath ? (
                  <a href={v.checkoutPhotoPath} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    {v.checkoutPhotoPath}
                  </a>
                ) : "-"}
              </div>
            </div>
          );
        },
      },
      {
        id: "selfie",
        header: t("selfie"),
        cell: ({ row }) =>
          row.original.selfieUrl ? (
            <img
              src={row.original.selfieUrl}
              alt="Selfie"
              className="h-10 w-10 rounded object-cover"
            />
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          ),
      },
      {
        id: "soCount",
        header: t("sosCreated"),
        cell: ({ row }) => row.original._count?.salesOrders ?? 0,
      },
      {
        id: "actions",
        header: t("actions"),
        cell: ({ row }) => (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/sales/visits/${row.original.id}`}>
              <Eye className="mr-1 h-4 w-4" />
              {t("viewDetail")}
            </Link>
          </Button>
        ),
      },
    ],
    [t]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("listTitle")}
        actions={
          <Button onClick={openCheckIn}>
            <Plus className="mr-2 h-4 w-4" />
            {t("checkIn")}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={visits}
        isLoading={loading}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc("viewAll")}</SelectItem>
                <SelectItem value="OPEN">{t("statusOpen")}</SelectItem>
                <SelectItem value="CHECKED_OUT">{t("statusCheckedOut")}</SelectItem>
                <SelectItem value="STALE_OPEN">{t("statusStaleOpen")}</SelectItem>
              </SelectContent>
            </Select>

            {session?.user?.role !== "STAFF" && (
              <Select value={salespersonFilter} onValueChange={setSalespersonFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={t("salesperson")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tc("viewAll")}</SelectItem>
                  {salespeople.map((sp) => (
                    <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" />
            <Button variant="outline" onClick={() => {
              setStatusFilter("all");
              setSalespersonFilter("all");
              setDateFrom("");
              setDateTo("");
            }}>
              {tc("reset")}
            </Button>
          </div>
        }
      />

      <Dialog open={checkInOpen} onOpenChange={(open) => !open && closeCheckIn()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("checkIn")}</DialogTitle>
            <DialogDescription>{t("checkInDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{t("selectCustomer")}</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectCustomer")} />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t("selfie")}</Label>
              {selfieData ? (
                <div className="relative">
                  <img src={selfieData} alt="Selfie preview" className="w-full rounded-lg" />
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute bottom-2 right-2"
                    onClick={() => {
                      setSelfieData(null);
                      startCamera();
                    }}
                  >
                    {t("retakePhoto")}
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <video ref={videoRef} className="w-full rounded-lg bg-muted" autoPlay playsInline muted />
                  <canvas ref={canvasRef} className="hidden" />
                  <Button
                    size="sm"
                    className="absolute bottom-2 left-1/2 -translate-x-1/2"
                    onClick={capturePhoto}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {t("takePhoto")}
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {gpsLoading ? (
                <span className="text-muted-foreground">{t("capturingGps")}</span>
              ) : gps ? (
                <span>{gps.lat.toFixed(6)}, {gps.lng.toFixed(6)} (±{gps.accuracy.toFixed(0)}m)</span>
              ) : (
                <Button size="sm" variant="outline" onClick={captureGps}>
                  {t("gpsLocation")}
                </Button>
              )}
            </div>

            {distanceWarning && (
              <Alert variant="destructive">
                <AlertDescription>{t("distanceWarning")}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label>{t("notes")}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeCheckIn}>{tc("cancel")}</Button>
            <Button onClick={handleCheckIn} disabled={submitting || !selectedCustomer}>
              {submitting ? tc("loading") : t("checkIn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
