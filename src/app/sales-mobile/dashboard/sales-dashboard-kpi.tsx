"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CircleDollarSign, ClipboardCheck, Clock3, ShoppingCart } from "lucide-react";

type DashboardKpi = {
  todayVisits: number;
  ordersToday: number;
  todayRevenue: number;
  pendingOrders: number;
  overdueInvoices: number;
};

export default function SalesDashboardKpi() {
  const t = useTranslations("salesMobile.dashboard");
  const locale = useLocale();

  const [data, setData] = useState<DashboardKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/sales-mobile/dashboard", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        if (!res.ok) throw new Error("failed_to_fetch_dashboard");

        const json = await res.json();
        if (!active) return;
        setData(json.data as DashboardKpi);
      } catch {
        if (!active) return;
        setError(t("kpi.error"));
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [t]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: locale === "id" ? 0 : 2,
      }),
    [locale],
  );

  if (loading) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("kpi.loading")}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border bg-muted/30" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error ?? t("kpi.error")}</div>;
  }

  const cards = [
    {
      key: "todayVisits",
      label: t("kpi.todayVisits"),
      value: numberFormatter.format(data.todayVisits),
      icon: ClipboardCheck,
      href: "/sales-mobile/visits/new",
      iconClass: "text-blue-600",
    },
    {
      key: "ordersToday",
      label: t("kpi.ordersToday"),
      value: numberFormatter.format(data.ordersToday),
      icon: ShoppingCart,
      href: "/sales-mobile/orders",
      iconClass: "text-primary",
    },
    {
      key: "todayRevenue",
      label: t("kpi.todayRevenue"),
      value: currencyFormatter.format(data.todayRevenue),
      icon: CircleDollarSign,
      href: "/sales-mobile/orders",
      iconClass: "text-green-600",
    },
    {
      key: "pendingOrders",
      label: t("kpi.pendingOrders"),
      value: numberFormatter.format(data.pendingOrders),
      icon: Clock3,
      href: "/sales-mobile/orders",
      iconClass: "text-amber-600",
    },
  ];

  const isEmpty =
    data.todayVisits === 0 &&
    data.ordersToday === 0 &&
    data.todayRevenue === 0 &&
    data.pendingOrders === 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.key} href={card.href} className="rounded-xl border bg-card p-3 shadow-sm transition-colors hover:bg-accent">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <Icon size={16} className={card.iconClass} />
              </div>
              <p className="mt-2 text-lg font-semibold leading-tight">{card.value}</p>
            </Link>
          );
        })}
      </div>

      {isEmpty && <p className="text-sm text-muted-foreground">{t("kpi.empty")}</p>}
    </div>
  );
}
