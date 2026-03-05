"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LinkedSO = {
  id: string;
  soNumber: string;
  status: string;
  grandTotal: number;
  createdAt: string;
};

type VisitDetail = {
  id: string;
  status: "OPEN" | "CHECKED_OUT" | "STALE_OPEN";
  checkInAt: string;
  checkoutAt: string | null;
  durationMinutes: number | null;
  notes: string | null;
  selfieUrl: string | null;
  checkoutPhotoPath: string | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsAccuracy: number | null;
  checkoutLat: number | null;
  checkoutLng: number | null;
  checkoutAccuracy: number | null;
  distanceFromCustomer: number | null;
  gpsReasonCode: string | null;
  overrideBy: string | null;
  overrideReason: string | null;
  customer: {
    id: string;
    name: string;
    address: string | null;
    gpsLatitude: number | null;
    gpsLongitude: number | null;
  };
  salesperson: { id: string; name: string };
  salesOrders: LinkedSO[];
};

function fmtDateTime(value?: string | null) {
  if (!value) return "-";
  return format(new Date(value), "dd MMM yyyy HH:mm");
}

function fmtCoord(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return "-";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function fmtDuration(minutes?: number | null) {
  if (minutes == null) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function VisitDetailPage() {
  const t = useTranslations("visits");
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<VisitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/visits/${id}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        const msg = json.error || t("detailLoadError");
        setError(msg);
        return;
      }

      setData(json.data);
    } catch {
      setError(t("detailLoadError"));
      toast.error(t("detailLoadError"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t("detailTitle")}
          actions={
            <Button asChild variant="outline">
              <Link href="/sales/visits">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("backToList")}
              </Link>
            </Button>
          }
        />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {error || t("detailNotFound")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("detailTitle")} #${data.id.slice(0, 8)}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/sales/visits">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("backToList")}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("visitInfo")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span>{t("status")}</span><StatusBadge status={data.status} /></div>
            <div className="flex items-center justify-between"><span>{t("checkInAt")}</span><span>{fmtDateTime(data.checkInAt)}</span></div>
            <div className="flex items-center justify-between"><span>{t("checkOutAt")}</span><span>{fmtDateTime(data.checkoutAt)}</span></div>
            <div className="flex items-center justify-between"><span>{t("duration")}</span><span>{fmtDuration(data.durationMinutes)}</span></div>
            <div className="flex items-center justify-between"><span>{t("distance")}</span><span>{data.distanceFromCustomer != null ? `${Math.round(data.distanceFromCustomer)}m` : "-"}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("parties")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4"><span>{t("customer")}</span><span className="text-right">{data.customer.name}</span></div>
            <div className="flex items-center justify-between gap-4"><span>{t("customerCode")}</span><span className="text-right">{data.customer.id.slice(0, 8)}</span></div>
            <div className="flex items-center justify-between gap-4"><span>{t("salesperson")}</span><span className="text-right">{data.salesperson.name}</span></div>
            <div className="flex items-center justify-between gap-4"><span>{t("address")}</span><span className="max-w-[60%] text-right">{data.customer.address ?? "-"}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("gpsDetails")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span>{t("checkInGps")}</span><span>{fmtCoord(data.gpsLatitude, data.gpsLongitude)}</span></div>
            <div className="flex items-center justify-between"><span>{t("checkOutGps")}</span><span>{fmtCoord(data.checkoutLat, data.checkoutLng)}</span></div>
            <div className="flex items-center justify-between"><span>{t("gpsAccuracy")}</span><span>{data.gpsAccuracy != null ? `±${Math.round(data.gpsAccuracy)}m` : "-"}</span></div>
            <div className="flex items-center justify-between"><span>{t("checkoutGpsAccuracy")}</span><span>{data.checkoutAccuracy != null ? `±${Math.round(data.checkoutAccuracy)}m` : "-"}</span></div>
            <div className="flex items-center justify-between"><span>{t("gpsReasonCode")}</span><span>{data.gpsReasonCode ?? "-"}</span></div>
            <div className="flex items-center justify-between"><span>{t("overrideBy")}</span><span>{data.overrideBy ?? "-"}</span></div>
            <div className="flex items-center justify-between"><span>{t("overrideReason")}</span><span>{data.overrideReason ?? "-"}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("notesAndPhotos")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="mb-1 text-muted-foreground">{t("notes")}</p>
              <p className="whitespace-pre-wrap">{data.notes || "-"}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-muted-foreground">{t("selfie")}</p>
                {data.selfieUrl ? (
                  <button
                    type="button"
                    onClick={() => setPreviewImage({ src: data.selfieUrl as string, title: t("selfie") })}
                    className="w-full"
                  >
                    <img
                      src={data.selfieUrl}
                      alt={t("selfie")}
                      className="h-48 w-full rounded border bg-muted/30 object-contain"
                    />
                  </button>
                ) : <p>-</p>}
              </div>
              <div>
                <p className="mb-1 text-muted-foreground">{t("checkoutPhoto")}</p>
                {data.checkoutPhotoPath ? (
                  <button
                    type="button"
                    onClick={() => setPreviewImage({ src: data.checkoutPhotoPath as string, title: t("checkoutPhoto") })}
                    className="w-full"
                  >
                    <img
                      src={data.checkoutPhotoPath}
                      alt={t("checkoutPhoto")}
                      className="h-48 w-full rounded border bg-muted/30 object-contain"
                    />
                  </button>
                ) : <p>-</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("linkedSalesOrders")}</CardTitle></CardHeader>
        <CardContent>
          {data.salesOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noLinkedSalesOrders")}</p>
          ) : (
            <div className="space-y-2">
              {data.salesOrders.map((so) => (
                <div key={so.id} className="flex items-center justify-between rounded border p-3 text-sm">
                  <div>
                    <p className="font-medium">{so.soNumber}</p>
                    <p className="text-xs text-muted-foreground">{fmtDateTime(so.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={so.status} />
                    <span>{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(so.grandTotal)}</span>
                    <Link href={`/sales/orders/${so.id}`} className="text-blue-600 hover:underline">
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="max-h-[92vh] max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
            <img src={previewImage.src} alt={previewImage.title} className="max-h-[92vh] max-w-[92vw] rounded border bg-black object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
