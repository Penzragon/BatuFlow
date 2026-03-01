"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle, Package, MapPin, ChevronRight, Truck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Stats {
  todayTrips: number;
  totalDeliveries: number;
  completedDeliveries: number;
  nextDelivery: {
    id: string;
    deliveryStatus: string;
    salesOrder: { customer: { name: string; address: string | null } };
  } | null;
}

export default function DriverDashboardPage() {
  const t = useTranslations("driver");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/driver/dashboard");
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch {
      toast.error(t("failedToLoadDashboard"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center text-muted-foreground">
          <RefreshCw size={24} className="mx-auto animate-spin" />
          <p className="mt-2 text-sm">{t("loading")}</p>
        </div>
      </div>
    );
  }

  const today = format(new Date(), "EEEE, dd MMMM yyyy");

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-bold">{t("goodMorning")}</h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-3 text-center shadow-sm">
          <Truck size={20} className="mx-auto text-primary" />
          <p className="mt-1 text-2xl font-bold">{stats?.todayTrips ?? 0}</p>
          <p className="text-xs text-muted-foreground">{t("todayTrips")}</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center shadow-sm">
          <CheckCircle size={20} className="mx-auto text-green-500" />
          <p className="mt-1 text-2xl font-bold">{stats?.completedDeliveries ?? 0}</p>
          <p className="text-xs text-muted-foreground">{t("deliveriesCompleted")}</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center shadow-sm">
          <Package size={20} className="mx-auto text-muted-foreground" />
          <p className="mt-1 text-2xl font-bold">{stats?.totalDeliveries ?? 0}</p>
          <p className="text-xs text-muted-foreground">{t("totalDeliveries")}</p>
        </div>
      </div>

      {/* Progress bar */}
      {stats && stats.totalDeliveries > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">{t("todayProgress")}</span>
            <span className="text-muted-foreground">{stats.completedDeliveries}/{stats.totalDeliveries}</span>
          </div>
          <div className="h-3 w-full rounded-full bg-muted">
            <div
              className="h-3 rounded-full bg-green-500 transition-all"
              style={{ width: `${(stats.completedDeliveries / stats.totalDeliveries) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Next Delivery */}
      {stats?.nextDelivery && (
        <div className="rounded-xl border bg-primary/5 p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-primary">{t("nextDelivery")}</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {stats.nextDelivery.deliveryStatus.replace("_", " ")}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin size={16} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">{stats.nextDelivery.salesOrder.customer.name}</p>
              {stats.nextDelivery.salesOrder.customer.address && (
                <p className="text-sm text-muted-foreground">{stats.nextDelivery.salesOrder.customer.address}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {stats?.todayTrips === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center shadow-sm">
          <Truck size={40} className="text-muted-foreground opacity-40" />
          <p className="font-medium">{t("noTripsToday")}</p>
          <p className="text-sm text-muted-foreground">{t("noTripsCheckBack")}</p>
        </div>
      )}

      {/* Quick link to trips */}
      <Link
        href="/driver/trips"
        className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm hover:bg-accent"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Truck size={18} className="text-primary" />
          </div>
          <div>
            <p className="font-medium">{t("viewMyTrips")}</p>
            <p className="text-xs text-muted-foreground">{t("seeAllAssignedTrips")}</p>
          </div>
        </div>
        <ChevronRight size={18} className="text-muted-foreground" />
      </Link>
    </div>
  );
}
